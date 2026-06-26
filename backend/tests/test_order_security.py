from app.extensions import db
from app.models.entities import Account, Address, Category, Complaint, Order, Product, Shop
from app.utils import make_token
from conftest import create_account


def auth_headers(account):
    return {"Authorization": f"Bearer {make_token(account)}"}


def test_create_order_rejects_other_users_address(client, app, sample_catalog):
    with app.app_context():
        buyer = Account.query.filter_by(username="buyer").first()
        other = create_account("other", "user", "other@example.com")
        address = Address(
            user_id=other.id,
            receiver_name="其他买家",
            phone="13800000001",
            province="云南省",
            city="昆明市",
            district="官渡区",
            detail="别人的地址",
        )
        db.session.add(address)
        db.session.commit()
        headers = auth_headers(buyer)
        product_id = Product.query.filter_by(name="苹果").first().id
        address_id = address.id

    response = client.post(
        "/api/orders",
        json={"product_id": product_id, "quantity": 1, "address_id": address_id},
        headers=headers,
    )

    assert response.status_code == 404


def test_pay_order_rejects_unavailable_product(client, app, sample_catalog):
    with app.app_context():
        buyer = Account.query.filter_by(username="buyer").first()
        address = Address(
            user_id=buyer.id,
            receiver_name="买家",
            phone="13800000000",
            province="云南省",
            city="昆明市",
            district="官渡区",
            detail="自有地址",
        )
        db.session.add(address)
        db.session.commit()
        headers = auth_headers(buyer)
        product_id = Product.query.filter_by(name="苹果").first().id
        address_id = address.id

    order_response = client.post(
        "/api/orders",
        json={"product_id": product_id, "quantity": 1},
        headers=headers,
    )
    order_id = order_response.get_json()["data"]["id"]

    with app.app_context():
        product = db.session.get(Product, product_id)
        product.status = "off_sale"
        db.session.commit()

    pay_response = client.post(
        f"/api/orders/{order_id}/pay",
        json={"address_id": address_id, "payment_method": "alipay"},
        headers=headers,
    )

    assert pay_response.status_code == 404


def test_user_can_only_comment_product_once(client, app, sample_catalog):
    with app.app_context():
        buyer = Account.query.filter_by(username="buyer").first()
        headers = auth_headers(buyer)
        product_id = Product.query.filter_by(name="苹果").first().id

    first = client.post(
        "/api/comments",
        json={"product_id": product_id, "rating": 10, "content": "很好"},
        headers=headers,
    )
    second = client.post(
        "/api/comments",
        json={"product_id": product_id, "rating": 9, "content": "再次评价"},
        headers=headers,
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_cart_quantity_cannot_exceed_stock(client, app, sample_catalog):
    with app.app_context():
        buyer = Account.query.filter_by(username="buyer").first()
        headers = auth_headers(buyer)
        product_id = Product.query.filter_by(name="车厘子").first().id

    response = client.post(
        "/api/cart",
        json={"product_id": product_id, "quantity": 7},
        headers=headers,
    )

    assert response.status_code == 400


def test_merchant_cannot_transfer_product_to_another_shop(client, app, sample_catalog):
    with app.app_context():
        merchant = Account.query.filter_by(username="merchant").first()
        other_merchant = create_account("merchant2", "merchant", "merchant2@example.com")
        category = Category.query.first()
        other_shop = Shop(
            owner_account_id=other_merchant.id,
            name="别家店铺",
            type="merchant",
            status="active",
            shipping_address="云南省昆明市五华区",
            phone="13800000002",
        )
        db.session.add(other_shop)
        db.session.flush()
        headers = auth_headers(merchant)
        product_id = Product.query.filter_by(name="苹果").first().id
        other_shop_id = other_shop.id
        category_id = category.id
        db.session.commit()

    response = client.put(
        f"/api/products/{product_id}",
        json={"shop_id": other_shop_id, "category_id": category_id},
        headers=headers,
    )

    assert response.status_code == 403


def test_page_query_ignores_invalid_page_params(client, sample_catalog):
    response = client.get("/api/shops?page=bad&page_size=also-bad")

    assert response.status_code == 200
    assert response.get_json()["data"]["page"] == 1


def test_admin_can_filter_complaints_by_keyword(client, app):
    with app.app_context():
        admin = create_account("admin", "admin", "admin@example.com")
        buyer = create_account("buyer2", "user", "buyer2@example.com")
        db.session.add_all([
            Complaint(complainant_id=buyer.id, title="物流破损", content="包装有破损", phone="13800000003"),
            Complaint(complainant_id=buyer.id, title="商品咨询", content="想了解储存条件", phone="13800000004"),
        ])
        db.session.commit()
        headers = auth_headers(admin)

    response = client.get("/api/complaints?keyword=物流", headers=headers)
    items = response.get_json()["data"]

    assert response.status_code == 200
    assert [item["title"] for item in items] == ["物流破损"]


def test_deleting_address_keeps_order_history(client, app, sample_catalog):
    with app.app_context():
        buyer = Account.query.filter_by(username="buyer").first()
        product = Product.query.filter_by(name="苹果").first()
        address = Address(
            user_id=buyer.id,
            receiver_name="买家",
            phone="13800000000",
            province="云南省",
            city="昆明市",
            district="官渡区",
            detail="自有地址",
        )
        db.session.add(address)
        db.session.flush()
        order = Order(
            order_no="ADDR001",
            user_id=buyer.id,
            shop_id=product.shop_id,
            product_id=product.id,
            quantity=1,
            unit_price=product.price,
            total_amount=product.price,
            address_id=address.id,
            status="待收货",
        )
        db.session.add(order)
        db.session.commit()
        headers = auth_headers(buyer)
        address_id = address.id
        order_id = order.id

    response = client.delete(f"/api/addresses/{address_id}", headers=headers)

    with app.app_context():
        kept_order = db.session.get(Order, order_id)

    assert response.status_code == 200
    assert kept_order is not None
    assert kept_order.address_id is None


def test_disabled_merchant_shop_blocks_existing_access_token(client, app, sample_catalog):
    with app.app_context():
        merchant = Account.query.filter_by(username="merchant").first()
        shop = Shop.query.filter_by(owner_account_id=merchant.id).first()
        headers = auth_headers(merchant)
        shop.status = "disabled"
        db.session.commit()

    response = client.get("/api/merchant/summary", headers=headers)

    assert response.status_code == 403


def test_disabled_merchant_shop_blocks_refresh_token(client, app, sample_catalog):
    with app.app_context():
        merchant = Account.query.filter_by(username="merchant").first()
        refresh_token = make_token(merchant, "refresh")
        shop = Shop.query.filter_by(owner_account_id=merchant.id).first()
        shop.status = "disabled"
        db.session.commit()

    response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})

    assert response.status_code == 401


def test_admin_cannot_disable_admin_account(client, app):
    with app.app_context():
        admin = create_account("admin", "admin", "admin@example.com")
        headers = auth_headers(admin)
        admin_id = admin.id

    response = client.put(
        f"/api/admin/accounts/{admin_id}/status",
        json={"status": "disabled"},
        headers=headers,
    )

    assert response.status_code == 403


def test_account_search_normalizes_email_case(client, app):
    with app.app_context():
        buyer = create_account("buyer", "user", "buyer@example.com")
        target = create_account("target", "user", "target@example.com")
        headers = auth_headers(buyer)
        target_id = target.id

    response = client.get("/api/accounts/search?email=TARGET@EXAMPLE.COM", headers=headers)

    assert response.status_code == 200
    assert response.get_json()["data"]["id"] == target_id
