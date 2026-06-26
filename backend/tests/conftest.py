import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import create_app
from app.extensions import db
from app.models.entities import Account, Category, Comment, Order, Product, Shop


@pytest.fixture()
def app():
    test_app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-jwt-secret",
        "ADMIN_INVITE_CODE": "000000",
        "CORS_ORIGINS": ["http://localhost:4200"],
    })
    with test_app.app_context():
        db.create_all()
        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def create_account(username="buyer", role="user", email="buyer@example.com"):
    account = Account(username=username, nickname=username, email=email, role=role, status="active")
    account.set_password("secret123")
    db.session.add(account)
    db.session.commit()
    return account


@pytest.fixture()
def sample_catalog(app):
    with app.app_context():
        merchant = create_account("merchant", "merchant", "merchant@example.com")
        buyer = create_account("buyer", "user", "buyer@example.com")
        category = Category(name="水果")
        db.session.add(category)
        db.session.flush()
        shop = Shop(
            owner_account_id=merchant.id,
            name="鲜果店",
            type="merchant",
            status="active",
            shipping_address="云南省昆明市官渡区",
            phone="13800000000",
        )
        db.session.add(shop)
        db.session.flush()
        apple = Product(shop_id=shop.id, category_id=category.id, name="苹果", price=9.9, unit="斤", stock=10, status="on_sale")
        cherry = Product(shop_id=shop.id, category_id=category.id, name="车厘子", price=39.9, unit="斤", stock=6, status="on_sale")
        db.session.add_all([apple, cherry])
        db.session.flush()
        db.session.add(Comment(product_id=cherry.id, user_id=buyer.id, rating=10, content="很新鲜"))
        db.session.add(Order(order_no="T001", user_id=buyer.id, shop_id=shop.id, product_id=apple.id, quantity=1, unit_price=9.9, total_amount=9.9, status="已收货"))
        db.session.add(Order(order_no="T002", user_id=buyer.id, shop_id=shop.id, product_id=cherry.id, quantity=1, unit_price=39.9, total_amount=39.9, status="已收货"))
        db.session.commit()
        return {"merchant": merchant, "buyer": buyer, "category": category, "shop": shop, "apple": apple, "cherry": cherry}
