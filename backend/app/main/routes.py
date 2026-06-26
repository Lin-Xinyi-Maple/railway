import secrets
import re
from datetime import timedelta

import requests
from flask import Blueprint, current_app, request
from requests import HTTPError
from sqlalchemy import and_, func, or_

from ..extensions import db
from ..models.entities import (
    Account,
    Address,
    CartItem,
    Category,
    Comment,
    Complaint,
    Favorite,
    Friend,
    Message,
    Order,
    ORDER_REVIEWABLE_STATUSES,
    ORDER_SETTLED_STATUSES,
    Product,
    Shop,
    SystemLog,
)
from ..schemas import (
    AddressSchema,
    AddressUpdateSchema,
    AdminMessageSchema,
    AiChatSchema,
    CartAddSchema,
    CategorySchema,
    CommentCreateSchema,
    ComplaintSchema,
    EmailCodeSchema,
    FriendInviteSchema,
    MessageReadSchema,
    OrderCreateSchema,
    PayOrderSchema,
    ProductPayloadSchema,
    ProductQuerySchema,
    ProfileSchema,
    ReplySchema,
    RestockSchema,
    SendMessageSchema,
    ShopPayloadSchema,
    ShopUpdateSchema,
    StatusSchema,
    SystemMessageSchema,
)
from ..storage import ObsConfigError, ObsUploadError, upload_image_to_obs
from ..time_utils import beijing_now
from ..utils import current_user, fail, login_required, ok, page_query, validate_json, validate_query

main_bp = Blueprint("main", __name__)
_shipping_geo_cache = {}


def settled_order_filter():
    return Order.status.in_(ORDER_SETTLED_STATUSES)


def _check_email_code(email, code):
    from ..extensions import verification_codes

    return verification_codes.get(email) == code


def _pop_email_code(email):
    from ..extensions import verification_codes

    verification_codes.delete(email)


def make_order_no():
    now = beijing_now()
    return f"{now:%Y%m%d%H%M%S}{int(now.microsecond / 1000):03d}{secrets.randbelow(90000) + 10000}"


def shipping_geo(address):
    clean_address = (address or "").strip()
    if not clean_address:
        return {"address": "", "lng": None, "lat": None, "source": "missing"}
    if clean_address in _shipping_geo_cache:
        return _shipping_geo_cache[clean_address]

    province, city, district = shipping_area_parts(clean_address)
    area_address = "".join(part for part in [province, city, district] if part) or clean_address
    fallback = shipping_fallback_point(clean_address, city, district)
    result = {
        "address": area_address,
        "full_address": clean_address,
        "province": province,
        "city": city,
        "district": district,
        "lng": None,
        "lat": None,
        "fallback_lng": fallback["lng"],
        "fallback_lat": fallback["lat"],
        "fallback_zoom": fallback["zoom"],
        "source": "local_area_parse",
    }
    _shipping_geo_cache[clean_address] = result
    return result


def shipping_area_parts(address):
    province = _first_match(address, [
        r"([\u4e00-\u9fa5]{2,}?省)",
        r"([\u4e00-\u9fa5]{2,}?自治区)",
        r"(北京市|天津市|上海市|重庆市)",
        r"(香港特别行政区|澳门特别行政区)",
    ])
    rest = address[address.find(province) + len(province):] if province and province in address else address
    city = _first_match(rest, [
        r"([\u4e00-\u9fa5]{2,}?市)",
        r"([\u4e00-\u9fa5]{2,}?自治州)",
        r"([\u4e00-\u9fa5]{2,}?地区)",
        r"([\u4e00-\u9fa5]{2,}?盟)",
    ])
    rest = rest[rest.find(city) + len(city):] if city and city in rest else rest
    district = _first_match(rest, [
        r"([\u4e00-\u9fa5]{1,}?区)",
        r"([\u4e00-\u9fa5]{1,}?县)",
        r"([\u4e00-\u9fa5]{1,}?市)",
        r"([\u4e00-\u9fa5]{1,}?旗)",
    ])
    return province, city, district


def shipping_fallback_point(address, city, district):
    area_points = [
        ("官渡区", 102.748888, 24.950285, 13),
        ("五华区", 102.704412, 25.042165, 13),
        ("盘龙区", 102.751643, 25.116512, 13),
        ("西山区", 102.664426, 25.038039, 13),
        ("呈贡区", 102.821675, 24.885735, 13),
        ("昆明市", 102.833669, 24.88149, 12),
        ("大理市", 100.267638, 25.606486, 12),
        ("云南省", 102.833669, 24.88149, 8),
    ]
    for key, lng, lat, zoom in area_points:
        if key and (key in address or key == city or key == district):
            return {"lng": lng, "lat": lat, "zoom": zoom}
    return {"lng": 102.833669, "lat": 24.88149, "zoom": 8}


def _first_match(text, patterns):
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return ""


def order_detail_payload(order, include_shipping_geo=False):
    data = order.detail_dict()
    shipping_address = order.shop.shipping_address if order.shop else ""
    data["shipping_notice"] = f"您的商品将从{shipping_address or '-'}这里发货，请耐心等待"
    data["baidu_map_ak"] = current_app.config.get("BAIDU_MAP_AK", "")
    if include_shipping_geo:
        data["shipping_geo"] = shipping_geo(shipping_address)
    return data


def can_view_order(user, order):
    if user.role == "user":
        return order.user_id == user.id
    if user.role == "merchant":
        return order.shop and order.shop.owner_account_id == user.id
    return user.role == "admin"


def comment_detail(comment):
    return {
        **comment.to_dict(),
        "user": comment.user.public_dict() if comment.user else None,
    }


def has_paid_for_product(user_id, product_id):
    return Order.query.filter(
        Order.user_id == user_id,
        Order.product_id == product_id,
        Order.status.in_(ORDER_REVIEWABLE_STATUSES),
    ).first() is not None


def owner_shop_ids(user):
    return [shop.id for shop in Shop.query.filter_by(owner_account_id=user.id).all()]


def range_days(value):
    if value == "year":
        return 365
    if value == "month":
        return 30
    return 7


def sales_series(query, days):
    today = beijing_now().date()
    start = today - timedelta(days=days - 1)
    buckets = {
        (start + timedelta(days=offset)).isoformat(): {
            "date": (start + timedelta(days=offset)).isoformat(),
            "sales": 0.0,
            "orders": 0,
        }
        for offset in range(days)
    }
    for order in query.filter(settled_order_filter(), Order.paid_at >= start).all():
        if not order.paid_at:
            continue
        key = order.paid_at.date().isoformat()
        if key in buckets:
            buckets[key]["sales"] += float(order.total_amount or 0)
            buckets[key]["orders"] += 1
    return list(buckets.values())


def system_message(receiver_id, title, content, link_url=None, image_url=None):
    db.session.add(Message(
        receiver_id=receiver_id,
        title=title,
        content=content,
        type="system",
        is_read=False,
        link_url=link_url,
        image_url=image_url,
    ))


def write_log(actor, action, target_type, target_id=None, detail=None, keep_actor=True):
    db.session.add(SystemLog(
        actor_id=actor.id if actor and keep_actor else None,
        actor_username=actor.username if actor else None,
        actor_role=actor.role if actor else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
    ))


def delete_messages_between(first_id, second_id):
    Message.query.filter(
        or_(
            (Message.sender_id == first_id) & (Message.receiver_id == second_id),
            (Message.sender_id == second_id) & (Message.receiver_id == first_id),
        )
    ).delete(synchronize_session=False)


def cleanup_account_links(account_id):
    Message.query.filter(or_(Message.sender_id == account_id, Message.receiver_id == account_id)).delete(synchronize_session=False)
    Friend.query.filter(or_(Friend.applicant_id == account_id, Friend.receiver_id == account_id)).delete(synchronize_session=False)
    SystemLog.query.filter_by(actor_id=account_id).update({"actor_id": None}, synchronize_session=False)


@main_bp.route("/account/profile", methods=["PUT", "PATCH"])
@login_required("user", "merchant", "admin")
def update_account_profile(user):
    data, error = validate_json(ProfileSchema)
    if error:
        return error
    nickname = data.nickname
    avatar = data.avatar or ""
    user.nickname = nickname
    user.avatar = avatar or None
    db.session.commit()
    return ok(user.public_dict(), "个人资料已更新")


@main_bp.post("/account/email")
@login_required("user", "merchant", "admin")
def update_account_email(user):
    data, error = validate_json(UpdateEmailSchema)
    if error:
        return error
    new_email = data.new_email
    if Account.query.filter(Account.email == new_email, Account.id != user.id).first():
        return fail("新邮箱已被其他账号使用", 409)
    if not _check_email_code(user.email, data.old_email_code):
        return fail("原邮箱验证码错误")
    if not _check_email_code(new_email, data.new_email_code):
        return fail("新邮箱验证码错误")
    old_email = user.email
    user.email = new_email
    db.session.add(Message(receiver_id=user.id, title="邮箱已换绑", content=f"账号邮箱已由 {old_email} 更改为 {new_email}。"))
    db.session.commit()
    _pop_email_code(old_email)
    _pop_email_code(new_email)
    return ok(user.public_dict(), "邮箱已更新")


@main_bp.post("/account/password")
@login_required("user", "merchant", "admin")
def update_account_password(user):
    data, error = validate_json(UpdatePasswordSchema)
    if error:
        return error
    if not user.check_password(data.current_password):
        return fail("当前密码错误", 401)
    user.set_password(data.new_password)
    db.session.add(Message(receiver_id=user.id, title="密码已修改", content="您的账号密码已成功修改。"))
    db.session.commit()
    return ok(True, "密码已修改")


@main_bp.delete("/account/me")
@login_required("user", "merchant")
def delete_own_account(user):
    data, error = validate_json(EmailCodeSchema)
    if error:
        return error
    code = data.email_code
    if not _check_email_code(user.email, code):
        return fail("邮箱验证码错误")
    account_id = user.id
    username = user.username
    role = user.role
    email = user.email
    cleanup_account_links(account_id)
    db.session.delete(user)
    db.session.flush()
    db.session.add(SystemLog(
        actor_username=username,
        actor_role=role,
        action="delete_own_account",
        target_type="account",
        target_id=account_id,
        detail="账号本人删除，相关业务记录已级联清理",
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
    ))
    db.session.commit()
    _pop_email_code(email)
    return ok(True, "账号已删除")


@main_bp.post("/uploads/avatar")
@login_required("user", "merchant", "admin")
def upload_avatar(user):
    file = request.files.get("file")
    if not file:
        return fail("请选择头像图片")
    try:
        return ok(upload_image_to_obs(file, "avatars"), "头像已上传")
    except ObsConfigError as exc:
        return fail(str(exc), 500)
    except (ValueError, HTTPError, ObsUploadError) as exc:
        return fail(str(exc), 400)


@main_bp.post("/uploads/product-image")
@login_required("merchant", "admin")
def upload_product_image(user):
    file = request.files.get("file")
    if not file:
        return fail("请选择商品图片")
    try:
        return ok(upload_image_to_obs(file, "products"), "商品图片已上传")
    except ObsConfigError as exc:
        return fail(str(exc), 500)
    except (ValueError, HTTPError, ObsUploadError) as exc:
        return fail(str(exc), 400)


@main_bp.post("/uploads/comment-image")
@login_required("user")
def upload_comment_image(user):
    file = request.files.get("file")
    if not file:
        return fail("请选择评论图片")
    try:
        return ok(upload_image_to_obs(file, "comments"), "评论图片已上传")
    except ObsConfigError as exc:
        return fail(str(exc), 500)
    except (ValueError, HTTPError, ObsUploadError) as exc:
        return fail(str(exc), 400)


@main_bp.post("/uploads/complaint-image")
@login_required("user", "merchant")
def upload_complaint_image(user):
    file = request.files.get("file")
    if not file:
        return fail("请选择投诉图片")
    try:
        return ok(upload_image_to_obs(file, "complaints"), "投诉图片已上传")
    except ObsConfigError as exc:
        return fail(str(exc), 500)
    except (ValueError, HTTPError, ObsUploadError) as exc:
        return fail(str(exc), 400)


@main_bp.post("/uploads/message-image")
@login_required("user", "merchant", "admin")
def upload_message_image(user):
    file = request.files.get("file")
    if not file:
        return fail("请选择消息图片")
    try:
        return ok(upload_image_to_obs(file, "messages"), "消息图片已上传")
    except ObsConfigError as exc:
        return fail(str(exc), 500)
    except (ValueError, HTTPError, ObsUploadError) as exc:
        return fail(str(exc), 400)


@main_bp.get("/categories")
def categories():
    return ok([item.to_dict() for item in Category.query.order_by(Category.name).all()])


@main_bp.post("/categories")
@login_required("admin")
def create_category(user):
    data, error = validate_json(CategorySchema)
    if error:
        return error
    item = Category(name=data.name)
    db.session.add(item)
    db.session.commit()
    return ok(item.to_dict(), "分类已创建", 201)


@main_bp.route("/products", methods=["GET"])
def products():
    params, error = validate_query(ProductQuerySchema)
    if error:
        return error
    query = Product.query.join(Shop).filter(Product.status == "on_sale", Shop.status == "active")
    keyword = params.keyword
    category_id = params.category_id
    shop_type = params.shop_type
    sort = params.sort or "newest"
    if keyword:
        query = query.filter(or_(Product.name.contains(keyword), Shop.name.contains(keyword)))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if shop_type:
        query = query.filter(Shop.type == shop_type)
    if sort == "paid_users":
        query = query.outerjoin(Order, and_(Order.product_id == Product.id, settled_order_filter())).group_by(Product.id)
        query = query.order_by(func.count(func.distinct(Order.user_id)).desc(), Product.created_at.desc())
    elif sort == "comments":
        query = query.outerjoin(Comment, Comment.product_id == Product.id).group_by(Product.id)
        query = query.order_by(func.count(Comment.id).desc(), Product.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Product.created_at.asc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc(), Product.created_at.desc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc(), Product.created_at.desc())
    else:
        query = query.order_by(Product.created_at.desc())
    return ok(page_query(query, lambda p: p.to_card()))


@main_bp.post("/products")
@login_required("merchant", "admin")
def create_product(user):
    data, error = validate_json(ProductPayloadSchema)
    if error:
        return error
    payload = data.present_fields()
    missing = [key for key in ["shop_id", "category_id", "name", "price"] if key not in payload]
    if missing:
        return fail(f"缺少必要字段：{', '.join(missing)}")
    shop = Shop.query.filter_by(id=data.shop_id).first()
    if not shop:
        return fail("店铺不存在", 404)
    if user.role != "admin" and shop.owner_account_id != user.id:
        return fail("只能管理自己的店铺", 403)
    if not db.session.get(Category, data.category_id):
        return fail("分类不存在", 404)
    product = Product(**{k: payload.get(k) for k in [
        "shop_id", "category_id", "name", "main_image", "image_2", "image_3", "detail", "price", "unit",
        "stock", "warning_stock", "origin", "planting_method", "shelf_life_days",
        "storage_condition", "status"
    ] if k in payload})
    db.session.add(product)
    db.session.commit()
    return ok(product.to_card(), "商品已发布", 201)


@main_bp.route("/products/<int:product_id>", methods=["GET", "PUT", "DELETE"])
def product_detail(product_id):
    product = Product.query.get_or_404(product_id)
    if request.method == "GET":
        user = current_user()
        can_manage = bool(user and (user.role == "admin" or product.shop.owner_account_id == user.id))
        if (product.status != "on_sale" or product.shop.status != "active") and not can_manage:
            return fail("商品不可用", 404)
        data = product.to_card()
        data["merchant_account_id"] = product.shop.owner_account_id if product.shop else None
        data["is_favorite"] = bool(user and Favorite.query.filter_by(user_id=user.id, product_id=product.id).first())
        data["images"] = [
            {"id": index + 1, "image_url": url}
            for index, url in enumerate([product.main_image, product.image_2, product.image_3])
            if url
        ]
        data["comments"] = [comment_detail(item) for item in sorted(product.comments, key=lambda c: c.created_at or beijing_now(), reverse=True)]
        return ok(data)

    user = current_user()
    if not user:
        return fail("请先登录", 401)
    if user.role != "admin" and product.shop.owner_account_id != user.id:
        return fail("权限不足", 403)
    if request.method == "DELETE":
        db.session.delete(product)
        db.session.commit()
        return ok(True, "商品已删除")
    data, error = validate_json(ProductPayloadSchema)
    if error:
        return error
    payload = data.present_fields()
    if "shop_id" in payload:
        target_shop = db.session.get(Shop, payload["shop_id"])
        if not target_shop:
            return fail("店铺不存在", 404)
        if user.role != "admin" and target_shop.owner_account_id != user.id:
            return fail("不能把商品转移到其他店铺", 403)
    if "category_id" in payload and not db.session.get(Category, payload["category_id"]):
        return fail("分类不存在", 404)
    for key, value in payload.items():
        if hasattr(product, key) and key not in {"id", "created_at"}:
            setattr(product, key, value)
    db.session.commit()
    return ok(product.to_card(), "商品已保存")


@main_bp.route("/shops", methods=["GET", "POST"])
def shops():
    if request.method == "GET":
        query = Shop.query.filter_by(status="active").order_by(Shop.created_at.desc())
        return ok(page_query(query, lambda s: s.to_dict()))
    return create_shop()


@main_bp.get("/shops/<int:shop_id>")
def shop_detail(shop_id):
    shop = Shop.query.get_or_404(shop_id)
    user = current_user()
    can_manage = bool(user and (user.role == "admin" or shop.owner_account_id == user.id))
    if shop.status != "active" and not can_manage:
        return fail("店铺不可用", 404)
    data = shop.to_dict()
    data["owner"] = shop.owner.public_dict() if shop.owner else None
    data["products_count"] = Product.query.filter_by(shop_id=shop.id, status="on_sale").count()
    data["paid_orders_count"] = Order.query.filter(Order.shop_id == shop.id, settled_order_filter()).count()
    data["paid_amount"] = float(db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.shop_id == shop.id, settled_order_filter()).scalar())
    data["products"] = [item.to_card() for item in Product.query.filter_by(shop_id=shop.id, status="on_sale").order_by(Product.created_at.desc()).limit(12).all()]
    return ok(data)


@main_bp.delete("/shops/<int:shop_id>")
@login_required("merchant", "admin")
def delete_shop(user, shop_id):
    shop = Shop.query.get_or_404(shop_id)
    if user.role != "admin" and shop.owner_account_id != user.id:
        return fail("只能删除自己的店铺", 403)
    if shop.type == "self" and user.role != "admin":
        return fail("自营店铺只能由管理员删除", 403)
    db.session.delete(shop)
    write_log(user, "delete_shop", "shop", shop_id, "删除店铺并级联清理商品、订单、购物车、收藏和评论")
    db.session.commit()
    return ok(True, "店铺及关联记录已删除")


@main_bp.delete("/merchant/shop")
@login_required("merchant", "admin")
def delete_own_shop(user):
    shop = Shop.query.filter_by(owner_account_id=user.id).first()
    if not shop:
        return fail("当前账号还没有店铺", 404)
    shop_id = shop.id
    db.session.delete(shop)
    write_log(user, "delete_own_shop", "shop", shop_id, "商家删除自己的店铺并级联清理关联记录")
    db.session.commit()
    return ok(True, "店铺及关联记录已删除")


@login_required("merchant", "admin")
def create_shop(user):
    data, error = validate_json(ShopPayloadSchema)
    if error:
        return error
    if Shop.query.filter_by(owner_account_id=user.id).first():
        return fail("一个账号只能开一个店铺", 409)
    shop_type = "self" if user.role == "admin" else "merchant"
    if shop_type == "self" and Shop.query.filter_by(type="self").first():
        return fail("系统只能有一个自营店铺", 409)
    shop = Shop(
        owner_account_id=user.id,
        name=data.name,
        description=data.description,
        type=shop_type,
        status="active",
        shipping_address=data.shipping_address,
        phone=data.phone,
    )
    db.session.add(shop)
    db.session.commit()
    return ok(shop.to_dict(), "店铺已提交", 201)


@main_bp.route("/merchant/shop", methods=["GET", "PUT"])
@login_required("merchant", "admin")
def merchant_own_shop(user):
    shop = Shop.query.filter_by(owner_account_id=user.id).first()
    if not shop:
        return fail("当前账号还没有店铺", 404)
    if request.method == "GET":
        data = shop.to_dict()
        data["owner"] = user.public_dict()
        data["products_count"] = Product.query.filter_by(shop_id=shop.id).count()
        data["paid_orders_count"] = Order.query.filter(Order.shop_id == shop.id, settled_order_filter()).count()
        data["paid_amount"] = float(db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.shop_id == shop.id, settled_order_filter()).scalar())
        return ok(data)
    data, error = validate_json(ShopUpdateSchema)
    if error:
        return error
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(shop, key, value)
    db.session.commit()
    return ok(shop.to_dict(), "店铺信息已更新")


@main_bp.get("/merchant/summary")
@login_required("merchant", "admin")
def merchant_summary(user):
    shops = Shop.query.filter_by(owner_account_id=user.id).all()
    shop_ids = [shop.id for shop in shops]
    on_sale_products = Product.query.filter(Product.shop_id.in_(shop_ids), Product.status == "on_sale").all() if shop_ids else []
    all_products = Product.query.filter(Product.shop_id.in_(shop_ids)).order_by(Product.created_at.desc()).all() if shop_ids else []
    paid_orders = Order.query.filter(Order.shop_id.in_(shop_ids), settled_order_filter()).order_by(Order.paid_at.desc()).all() if shop_ids else []
    low_stock_products = Product.query.filter(
        Product.shop_id.in_(shop_ids),
        Product.status == "on_sale",
        Product.stock <= Product.warning_stock,
    ).order_by(Product.stock.asc()).all() if shop_ids else []
    sales = sum(float(order.total_amount or 0) for order in paid_orders)
    days = range_days(request.args.get("range"))
    return ok({
        "shops": [s.to_dict() for s in shops],
        "products_count": len(on_sale_products),
        "orders_count": len(paid_orders),
        "low_stock": len(low_stock_products),
        "sales": sales,
        "product_list": [item.to_card() for item in all_products],
        "order_list": [item.detail_dict() for item in paid_orders],
        "low_stock_products": [item.to_card() for item in low_stock_products],
        "income_details": [item.detail_dict() for item in paid_orders],
        "chart": sales_series(Order.query.filter(Order.shop_id.in_(shop_ids)), days) if shop_ids else [],
    })


@main_bp.get("/merchant/after-sales")
@login_required("merchant", "admin")
def merchant_after_sales(user):
    shop_ids = owner_shop_ids(user)
    query = Order.query.filter(Order.shop_id.in_(shop_ids), Order.status.in_(["售后中", "完成售后"])) if shop_ids else Order.query.filter(Order.id == -1)
    keyword = (request.args.get("keyword") or "").strip()
    if keyword:
        query = query.filter(Order.order_no.contains(keyword))
    return ok(page_query(query.order_by(Order.created_at.desc()), lambda order: {
        **order.detail_dict(),
        "user": order.user.public_dict() if order.user else None,
    }))


@main_bp.post("/merchant/products/<int:product_id>/restock")
@login_required("merchant", "admin")
def merchant_restock_product(user, product_id):
    product = Product.query.get_or_404(product_id)
    if user.role != "admin" and (not product.shop or product.shop.owner_account_id != user.id):
        return fail("只能给自己店铺的商品补货", 403)
    data, error = validate_json(RestockSchema)
    if error:
        return error
    quantity = data.quantity
    product.stock = int(product.stock or 0) + quantity
    db.session.commit()
    return ok(product.to_card(), "补货成功")


@main_bp.route("/cart", methods=["GET", "POST", "DELETE"])
@login_required("user")
def cart(user):
    if request.method == "GET":
        items = CartItem.query.filter_by(user_id=user.id).all()
        return ok([{
            **item.to_dict(),
            "unit_price": float(item.product.price),
            "line_total": float(item.product.price) * item.quantity,
            "product": item.product.to_card(),
        } for item in items if item.product and item.product.status == "on_sale" and item.product.shop.status == "active"])
    if request.method == "DELETE":
        CartItem.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        return ok(True, "购物车已清空")
    data, error = validate_json(CartAddSchema)
    if error:
        return error
    quantity = data.quantity
    product = Product.query.join(Shop).filter(Product.id == data.product_id, Product.status == "on_sale", Shop.status == "active").first()
    if not product:
        return fail("商品不可用", 404)
    if product.stock < quantity:
        return fail("库存不足")
    item = CartItem.query.filter_by(user_id=user.id, product_id=data.product_id).first()
    if item:
        if item.quantity + quantity > product.stock:
            return fail("购物车数量不能超过当前库存")
        item.quantity += quantity
    else:
        item = CartItem(user_id=user.id, product_id=data.product_id, quantity=quantity)
        db.session.add(item)
    db.session.commit()
    return ok(item.to_dict(), "已加入购物车", 201)


@main_bp.delete("/cart/<int:item_id>")
@login_required("user")
def delete_cart_item(user, item_id):
    item = CartItem.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return fail("购物车记录不存在", 404)
    db.session.delete(item)
    db.session.commit()
    return ok(True, "购物车记录已删除")


@main_bp.route("/addresses", methods=["GET", "POST"])
@login_required("user")
def addresses(user):
    if request.method == "GET":
        return ok([addr.to_dict() for addr in Address.query.filter_by(user_id=user.id).all()])
    data, error = validate_json(AddressSchema)
    if error:
        return error
    payload = data.model_dump()
    if payload.get("is_default"):
        Address.query.filter_by(user_id=user.id).update({"is_default": False})
    addr = Address(user_id=user.id, **payload)
    db.session.add(addr)
    db.session.commit()
    return ok(addr.to_dict(), "地址已保存", 201)


@main_bp.route("/addresses/<int:address_id>", methods=["GET", "PUT", "DELETE"])
@login_required("user")
def address_detail(user, address_id):
    address = Address.query.filter_by(id=address_id, user_id=user.id).first()
    if not address:
        return fail("收货地址不存在", 404)
    if request.method == "GET":
        return ok(address.to_dict())
    if request.method == "DELETE":
        Order.query.filter_by(address_id=address.id).update({"address_id": None}, synchronize_session=False)
        db.session.delete(address)
        write_log(user, "delete_address", "address", address_id, "用户删除收货地址，历史订单保留并清空地址引用")
        db.session.commit()
        return ok(True, "收货地址已删除")
    data, error = validate_json(AddressUpdateSchema)
    if error:
        return error
    payload = data.model_dump(exclude_unset=True)
    if payload.get("is_default"):
        Address.query.filter(Address.user_id == user.id, Address.id != address.id).update({"is_default": False})
    for key, value in payload.items():
        setattr(address, key, value)
    write_log(user, "update_address", "address", address.id, "用户更新收货地址")
    db.session.commit()
    return ok(address.to_dict(), "收货地址已更新")


@main_bp.route("/orders", methods=["GET", "POST"])
@login_required("user", "merchant", "admin")
def orders(user):
    if request.method == "GET":
        query = Order.query
        if user.role == "user":
            query = query.filter_by(user_id=user.id, is_visible=True)
        elif user.role == "merchant":
            shop_ids = [s.id for s in Shop.query.filter_by(owner_account_id=user.id).all()]
            query = query.filter(Order.shop_id.in_(shop_ids), settled_order_filter())
        return ok(page_query(query.order_by(Order.created_at.desc()), lambda o: o.detail_dict()))

    if user.role != "user":
        return fail("只有普通用户可以下单", 403)
    data, error = validate_json(OrderCreateSchema)
    if error:
        return error
    product = Product.query.join(Shop).filter(Product.id == data.product_id, Product.status == "on_sale", Shop.status == "active").first()
    if not product:
        return fail("商品不可用", 404)
    quantity = data.quantity
    if product.stock < quantity:
        return fail("库存不足")
    address_id = None
    if data.address_id is not None:
        address = Address.query.filter_by(id=data.address_id, user_id=user.id).first()
        if not address:
            return fail("收货地址不存在", 404)
        address_id = address.id
    unit_price = float(product.price)
    order = Order(
        order_no=make_order_no(),
        user_id=user.id,
        shop_id=product.shop_id,
        product_id=product.id,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=unit_price * quantity,
        address_id=address_id,
        status="待付款",
    )
    db.session.add(order)
    db.session.commit()
    return ok(order.detail_dict(), "订单已创建", 201)


@main_bp.get("/orders/<int:order_id>")
@login_required("user", "merchant", "admin")
def order_detail(user, order_id):
    order = Order.query.get_or_404(order_id)
    if not can_view_order(user, order):
        return fail("权限不足", 403)
    return ok(order_detail_payload(order))


@main_bp.get("/orders/<int:order_id>/shipping-geo")
@login_required("user", "merchant", "admin")
def order_shipping_geo(user, order_id):
    order = Order.query.get_or_404(order_id)
    if not can_view_order(user, order):
        return fail("权限不足", 403)
    shipping_address = order.shop.shipping_address if order.shop else ""
    return ok({
        "shipping_geo": shipping_geo(shipping_address),
        "shipping_notice": f"您的商品将从{shipping_address or '-'}这里发货，请耐心等待",
        "baidu_map_ak": current_app.config.get("BAIDU_MAP_AK", ""),
    })


@main_bp.delete("/orders/<int:order_id>")
@login_required("user")
def hide_order(user, order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != user.id:
        return fail("权限不足", 403)
    order.is_visible = False
    db.session.commit()
    return ok(True, "订单已删除")


@main_bp.post("/orders/<int:order_id>/pay")
@login_required("user")
def pay_order(user, order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != user.id:
        return fail("权限不足", 403)
    data, error = validate_json(PayOrderSchema)
    if error:
        return error
    address = Address.query.filter_by(id=data.address_id, user_id=user.id).first()
    if not address:
        return fail("请选择收货地址")
    if order.status != "待付款":
        return fail("订单已经支付")
    product = db.session.get(Product, order.product_id)
    if product:
        db.session.refresh(product)
    if not product or product.status != "on_sale" or not product.shop or product.shop.status != "active":
        return fail("商品不可用", 404)
    updated = Product.query.filter(
        Product.id == order.product_id,
        Product.stock >= order.quantity,
        Product.status == "on_sale",
    ).update({Product.stock: Product.stock - order.quantity}, synchronize_session=False)
    if updated != 1:
        return fail("库存不足")
    order.address_id = address.id
    order.payment_method = data.payment_method
    order.paid_at = beijing_now()
    order.status = "待收货"
    db.session.commit()
    return ok(order.detail_dict(), "支付成功")


@main_bp.post("/orders/<int:order_id>/receive")
@login_required("user")
def receive_order(user, order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != user.id:
        return fail("权限不足", 403)
    if order.status != "待收货":
        return fail("只有待收货订单可以确认收货")
    order.status = "已收货"
    db.session.commit()
    return ok(order_detail_payload(order), "已确认收货")


@main_bp.post("/orders/<int:order_id>/after-sale")
@login_required("user")
def apply_after_sale(user, order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != user.id:
        return fail("权限不足", 403)
    if order.status != "已收货":
        return fail("只有已收货订单可以申请售后")
    order.status = "售后中"
    db.session.commit()
    return ok(order_detail_payload(order), "已进入售后")


@main_bp.post("/orders/<int:order_id>/after-sale/complete")
@login_required("user")
def complete_after_sale(user, order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != user.id:
        return fail("权限不足", 403)
    if order.status != "售后中":
        return fail("只有售后中的订单可以完成售后")
    order.status = "完成售后"
    db.session.commit()
    return ok(order_detail_payload(order), "售后已完成")


@main_bp.post("/comments")
@login_required("user")
def comment(user):
    data, error = validate_json(CommentCreateSchema)
    if error:
        return error
    product = Product.query.get_or_404(data.product_id)
    if not has_paid_for_product(user.id, product.id):
        return fail("只有付款购买过该商品后才可以发布评价", 403)
    if Comment.query.filter_by(user_id=user.id, product_id=product.id).first():
        return fail("每个商品只能评价一次", 409)
    item = Comment(user_id=user.id, product_id=product.id, rating=data.rating, content=data.content, image_url=data.image_url)
    db.session.add(item)
    system_message(
        product.shop.owner_account_id,
        "新的商品评价",
        "有人发布评论了，点击查看。",
        link_url=f"/products/{product.id}/comments",
    )
    db.session.commit()
    return ok(comment_detail(item), "评论已发布", 201)


@main_bp.get("/products/<int:product_id>/comments")
def product_comments(product_id):
    product = Product.query.get_or_404(product_id)
    user = current_user()
    can_manage = bool(user and (user.role == "admin" or product.shop.owner_account_id == user.id))
    if (product.status != "on_sale" or product.shop.status != "active") and not can_manage:
        return fail("商品不可用", 404)
    can_comment = bool(user and user.role == "user" and has_paid_for_product(user.id, product_id))
    can_reply = bool(user and user.role in {"merchant", "admin"} and (user.role == "admin" or product.shop.owner_account_id == user.id))
    comments = [comment_detail(item) for item in Comment.query.filter_by(product_id=product_id).order_by(Comment.created_at.desc()).all()]
    return ok({
        "product": product.to_card(),
        "comments": comments,
        "can_comment": can_comment,
        "can_reply": can_reply,
    })


@main_bp.post("/comments/<int:comment_id>/reply")
@login_required("merchant", "admin")
def reply_comment(user, comment_id):
    item = Comment.query.get_or_404(comment_id)
    if user.role != "admin" and item.product.shop.owner_account_id != user.id:
        return fail("权限不足", 403)
    data, error = validate_json(ReplySchema)
    if error:
        return error
    item.merchant_reply = data.reply
    item.merchant_replied_at = beijing_now()
    system_message(
        item.user_id,
        "商家已回复评价",
        "你的评价已被回复，快去查看。",
        link_url=f"/products/{item.product_id}/comments",
    )
    db.session.commit()
    return ok(comment_detail(item), "已回复评论")


@main_bp.delete("/comments/<int:comment_id>")
@login_required("user", "merchant", "admin")
def delete_comment(user, comment_id):
    item = Comment.query.get_or_404(comment_id)
    if user.role == "user":
        if item.user_id != user.id:
            return fail("不能删除别人的评论", 403)
        db.session.delete(item)
        db.session.commit()
        return ok(True, "评论已删除")
    if user.role == "merchant":
        if not item.product or item.product.shop.owner_account_id != user.id:
            return fail("不能处理其他商家的回复", 403)
        item.merchant_reply = None
        item.merchant_replied_at = None
        db.session.commit()
        return ok(True, "商家回复已删除")
    db.session.delete(item)
    db.session.commit()
    return ok(True, "评论已删除")


@main_bp.delete("/comments/<int:comment_id>/reply")
@login_required("merchant", "admin")
def delete_comment_reply(user, comment_id):
    item = Comment.query.get_or_404(comment_id)
    if user.role == "merchant" and (not item.product or item.product.shop.owner_account_id != user.id):
        return fail("不能处理其他商家的回复", 403)
    item.merchant_reply = None
    item.merchant_replied_at = None
    db.session.commit()
    return ok(True, "商家回复已删除")


@main_bp.route("/complaints", methods=["GET", "POST"])
@login_required("user", "merchant", "admin")
def complaints(user):
    if request.method == "GET":
        query = Complaint.query
        if user.role != "admin":
            query = query.filter_by(complainant_id=user.id)
        processed = request.args.get("processed")
        keyword = (request.args.get("keyword") or "").strip()
        if processed in {"0", "1"}:
            query = query.filter_by(is_processed=processed == "1")
        if keyword:
            query = query.filter(or_(Complaint.title.contains(keyword), Complaint.content.contains(keyword), Complaint.phone.contains(keyword)))
        return ok([item.detail_dict() for item in query.order_by(Complaint.created_at.desc()).all()])
    if user.role == "admin":
        return fail("管理员只负责查看投诉与反馈", 403)
    data, error = validate_json(ComplaintSchema)
    if error:
        return error
    item = Complaint(
        complainant_id=user.id,
        title=data.title,
        content=data.content,
        image1=data.image1,
        image2=data.image2,
        image3=data.image3,
        phone=data.phone,
    )
    db.session.add(item)
    db.session.commit()
    return ok(item.detail_dict(), "投诉与反馈已提交", 201)


@main_bp.route("/complaints/<int:complaint_id>", methods=["GET", "PUT", "DELETE"])
@login_required("user", "merchant", "admin")
def complaint_detail(user, complaint_id):
    item = Complaint.query.get_or_404(complaint_id)
    if user.role != "admin" and item.complainant_id != user.id:
        return fail("权限不足", 403)
    if request.method == "GET":
        return ok(item.detail_dict())
    if user.role == "admin":
        return fail("管理员只能查看投诉与反馈，不能替用户撤销或修改", 403)
    if item.is_processed:
        return fail("该投诉与反馈已处理，不能再编辑或撤销", 403)
    if request.method == "DELETE":
        db.session.delete(item)
        write_log(user, "delete_complaint", "complaint", complaint_id, "用户撤销自己的投诉与反馈")
        db.session.commit()
        return ok(True, "投诉与反馈已撤销")
    data, error = validate_json(ComplaintSchema)
    if error:
        return error
    item.title = data.title
    item.content = data.content
    item.phone = data.phone
    item.image1 = data.image1
    item.image2 = data.image2
    item.image3 = data.image3
    write_log(user, "update_complaint", "complaint", item.id, "用户修改自己的投诉与反馈")
    db.session.commit()
    return ok(item.detail_dict(), "投诉与反馈已更新")


@main_bp.put("/complaints/<int:complaint_id>/processed")
@login_required("admin")
def process_complaint(user, complaint_id):
    item = Complaint.query.get_or_404(complaint_id)
    item.is_processed = True
    write_log(user, "process_complaint", "complaint", complaint_id, "管理员标记投诉与反馈为已处理")
    db.session.commit()
    return ok(item.detail_dict(), "投诉与反馈已标记为已处理")


@main_bp.get("/user/reviewable-orders")
@login_required("user")
def reviewable_orders(user):
    orders = Order.query.filter(
        Order.user_id == user.id,
        Order.status.in_(ORDER_REVIEWABLE_STATUSES),
    ).order_by(Order.created_at.desc()).all()
    return ok([order.detail_dict() for order in orders])


@main_bp.route("/favorites/<int:product_id>", methods=["POST", "DELETE"])
@login_required("user")
def favorite(user, product_id):
    Product.query.get_or_404(product_id)
    existing = Favorite.query.filter_by(user_id=user.id, product_id=product_id).first()
    if request.method == "DELETE":
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return ok(True, "已取消收藏")
    if not existing:
        db.session.add(Favorite(user_id=user.id, product_id=product_id))
        db.session.commit()
    return ok(True, "已收藏")


@main_bp.get("/favorites")
@login_required("user")
def my_favorites(user):
    rows = Favorite.query.filter_by(user_id=user.id).order_by(Favorite.created_at.desc()).all()
    return ok([{
        **item.to_dict(),
        "product": item.product.to_card(),
    } for item in rows if item.product and item.product.status == "on_sale" and item.product.shop.status == "active"])


@main_bp.delete("/favorites/items/<int:favorite_id>")
@login_required("user")
def delete_favorite_item(user, favorite_id):
    item = Favorite.query.filter_by(id=favorite_id, user_id=user.id).first()
    if not item:
        return fail("收藏记录不存在", 404)
    db.session.delete(item)
    db.session.commit()
    return ok(True, "收藏已删除")


@main_bp.get("/messages")
@login_required("user", "merchant", "admin")
def messages(user):
    items = Message.query.filter(
        or_(Message.receiver_id == user.id, Message.sender_id == user.id),
        Message.type.in_(["system", "system_chat", "chat"]),
    ).order_by(Message.created_at.desc()).all()
    return ok([msg.detail_dict() for msg in items])


@main_bp.get("/messages/unread-count")
@login_required("user", "merchant", "admin")
def message_unread_count(user):
    count = Message.query.filter(
        Message.receiver_id == user.id,
        Message.is_read.is_(False),
        Message.type.in_(["system", "system_chat", "chat"]),
    ).count()
    return ok({"count": count})


@main_bp.post("/messages/read")
@login_required("user", "merchant", "admin")
def mark_messages_read(user):
    data, error = validate_json(MessageReadSchema)
    if error:
        return error
    query = Message.query.filter_by(receiver_id=user.id, is_read=False)
    if data.thread_key == "system":
        query = query.filter(Message.sender_id.is_(None), Message.type == "system")
    elif data.sender_id:
        query = query.filter(Message.sender_id == data.sender_id)
    else:
        return fail("请选择要标记已读的消息")
    query.update({"is_read": True})
    db.session.commit()
    return ok({"count": Message.query.filter_by(receiver_id=user.id, is_read=False).count()})


@main_bp.post("/messages/system")
@login_required("user", "merchant", "admin")
def send_system_message(user):
    data, error = validate_json(SystemMessageSchema)
    if error:
        return error
    content = data.content
    image_url = data.image_url or ""
    if not content and not image_url:
        return fail("消息内容不能为空")
    message = Message(
        sender_id=user.id,
        receiver_id=user.id,
        title="我",
        content=content,
        type="system_chat",
        is_read=True,
        image_url=image_url or None,
    )
    db.session.add(message)
    db.session.commit()
    return ok(message.detail_dict(), "消息已发送", 201)


@main_bp.post("/messages/send")
@login_required("user", "merchant", "admin")
def send_message(user):
    data, error = validate_json(SendMessageSchema)
    if error:
        return error
    content = data.content
    image_url = data.image_url or ""
    receiver = db.session.get(Account, data.receiver_id)
    if not receiver:
        return fail("接收人不存在", 404)
    if receiver.status != "active":
        return fail("接收人账号不可用", 403)
    if receiver.id == user.id:
        return fail("不能给自己发送普通聊天消息")
    if not content and not image_url:
        return fail("消息内容不能为空")
    message = Message(
        sender_id=user.id,
        receiver_id=receiver.id,
        title=user.nickname or user.username,
        content=content,
        type="chat",
        is_read=False,
        image_url=image_url or None,
    )
    db.session.add(message)
    db.session.commit()
    return ok(message.detail_dict(), "消息已发送", 201)


@main_bp.post("/admin/messages/send")
@login_required("admin")
def admin_send_message(user):
    data, error = validate_json(AdminMessageSchema)
    if error:
        return error
    content = data.content
    image_url = data.image_url or ""
    target_mode = data.target_mode
    receiver_emails = data.receiver_emails
    if not content and not image_url:
        return fail("消息内容不能为空")
    query = Account.query.filter(Account.status == "active")
    if target_mode == "all_users":
        query = query.filter(Account.role == "user")
    elif target_mode == "all_merchants":
        query = query.filter(Account.role == "merchant")
    elif target_mode == "selected":
        emails = [str(item).strip() for item in receiver_emails if str(item).strip()]
        if not emails:
            return fail("请输入接收邮箱")
        query = query.filter(Account.role.in_(["user", "merchant"]), Account.email.in_(emails))
    else:
        return fail("请选择发送范围")
    receivers = query.all()
    if not receivers:
        return fail("没有可发送的接收人")
    for receiver in receivers:
        db.session.add(Message(
            sender_id=None,
            receiver_id=receiver.id,
            title="系统通知",
            content=content,
            type="system",
            is_read=False,
            image_url=image_url or None,
        ))
    db.session.commit()
    return ok({"sent": len(receivers)}, "系统消息已发送")


@main_bp.get("/friends")
@login_required("user")
def friends(user):
    rows = Friend.query.filter(
        or_(Friend.applicant_id == user.id, Friend.receiver_id == user.id)
    ).order_by(Friend.created_at.desc()).all()
    return ok({
        "friends": [item.detail_dict(user.id) for item in rows if item.is_accepted],
        "requests": [item.detail_dict(user.id) for item in rows if not item.is_accepted],
    })


@main_bp.get("/accounts/search")
@login_required("user")
def search_account_by_email(user):
    email = (request.args.get("email") or "").strip().lower()
    if not email:
        return fail("请输入邮箱")
    account = Account.query.filter_by(email=email, role="user", status="active").first()
    if not account or account.id == user.id:
        return fail("没有找到可添加的普通买家", 404)
    return ok(account.public_dict())


@main_bp.post("/friends/invite")
@login_required("user")
def invite_friend(user):
    data, error = validate_json(FriendInviteSchema)
    if error:
        return error
    email = data.email
    account = Account.query.filter_by(email=email, role="user", status="active").first()
    if not account or account.id == user.id:
        return fail("没有找到可添加的普通买家", 404)
    existing = Friend.query.filter_by(applicant_id=user.id, receiver_id=account.id).first()
    if existing:
        return fail("你们已经是好友" if existing.is_accepted else "好友申请已发送，请等待对方认证", 409)
    reverse_existing = Friend.query.filter_by(applicant_id=account.id, receiver_id=user.id).first()
    if reverse_existing:
        return fail(
            "你们已经是好友" if reverse_existing.is_accepted else "对方已向你发送好友申请，请在社区中同意",
            409,
        )
    friend = Friend(applicant_id=user.id, receiver_id=account.id, is_accepted=False)
    db.session.add(friend)
    db.session.add(Message(
        receiver_id=account.id,
        title="好友申请",
        content=f"{user.nickname or user.username} 申请添加你为好友",
        type="system",
        is_read=False,
        link_url="/friends/add",
    ))
    db.session.commit()
    return ok(friend.detail_dict(user.id), "好友申请已发送", 201)


@main_bp.post("/friends/requests/<int:friend_id>/accept")
@login_required("user")
def accept_friend(user, friend_id):
    friend = Friend.query.filter_by(id=friend_id, receiver_id=user.id).first()
    if not friend:
        return fail("好友申请不存在", 404)
    if friend.is_accepted:
        return ok(friend.detail_dict(user.id), "已经是好友")
    inviter = db.session.get(Account, friend.applicant_id)
    if not inviter or inviter.role != "user" or inviter.status != "active":
        return fail("邀请人账号不可用", 403)
    friend.is_accepted = True
    friend.accepted_at = beijing_now()
    message = Message(
        sender_id=user.id,
        receiver_id=friend.applicant_id,
        title="好友已添加",
        content="我们已成为好友，现在可以开始聊天啦",
        type="chat",
        is_read=False,
    )
    db.session.add(message)
    db.session.commit()
    return ok(friend.detail_dict(user.id), "已同意好友申请")


@main_bp.delete("/friends/<int:friend_id>")
@login_required("user")
def delete_friend(user, friend_id):
    friend = Friend.query.filter(
        Friend.id == friend_id,
        or_(Friend.applicant_id == user.id, Friend.receiver_id == user.id),
    ).first()
    if not friend:
        return fail("好友关系不存在", 404)
    other_id = friend.receiver_id if friend.applicant_id == user.id else friend.applicant_id
    delete_messages_between(user.id, other_id)
    db.session.delete(friend)
    write_log(user, "delete_friend", "friend", friend_id, f"删除好友关系并清理双方消息：{user.id}/{other_id}")
    db.session.commit()
    return ok(True, "好友关系和双方消息已删除")


@main_bp.get("/user/stats")
@login_required("user")
def user_stats(user):
    query = Order.query.filter_by(user_id=user.id)
    created_count = query.count()
    paid_count = query.filter(settled_order_filter()).count()
    paid_amount = float(db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.user_id == user.id, settled_order_filter()).scalar())
    category_rows = (
        db.session.query(Category.name, func.coalesce(func.sum(Order.total_amount), 0))
        .join(Product, Product.category_id == Category.id)
        .join(Order, Order.product_id == Product.id)
        .filter(Order.user_id == user.id, settled_order_filter())
        .group_by(Category.id, Category.name)
        .all()
    )
    today = beijing_now().date()
    daily = {
        (today - timedelta(days=offset)).isoformat(): {"date": (today - timedelta(days=offset)).isoformat(), "created": 0, "paid": 0, "amount": 0.0}
        for offset in range(6, -1, -1)
    }
    recent_start = today - timedelta(days=6)
    recent_orders = Order.query.filter(Order.user_id == user.id, Order.created_at >= recent_start).all()
    for order in recent_orders:
        if order.created_at:
            key = order.created_at.date().isoformat()
            if key in daily:
                daily[key]["created"] += 1
        if order.paid_at and order.status in ORDER_SETTLED_STATUSES:
            paid_key = order.paid_at.date().isoformat()
            if paid_key in daily:
                daily[paid_key]["paid"] += 1
                daily[paid_key]["amount"] += float(order.total_amount or 0)
    return ok({
        "created_orders": created_count,
        "paid_orders": paid_count,
        "paid_amount": paid_amount,
        "category_paid": [{"name": name, "amount": float(amount)} for name, amount in category_rows],
        "daily": list(daily.values()),
    })


@main_bp.post("/ai/review/<int:product_id>")
@login_required("user", "merchant", "admin")
def ai_review(user, product_id):
    product = Product.query.get_or_404(product_id)
    fallback = (
        f"商品“{product.name}”的基础信息已读取。建议重点核验产地、库存、储存条件、"
        "价格是否与页面描述一致。当前未配置 DeepSeek API Key，因此返回本地监管提示。"
    )
    score = 72
    conclusion = fallback
    if current_app.config["DEEPSEEK_API_KEY"]:
        prompt = (
            "你是农产品电商平台的AI监管助手。请根据商品信息判断宣传是否可信，"
            "指出需要人工复核的风险点，回复要简洁明确。\n"
            f"商品信息：{product.to_card()}"
        )
        try:
            resp = requests.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Authorization": f"Bearer {current_app.config['DEEPSEEK_API_KEY']}"},
                json={"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}]},
                timeout=20,
            )
            resp.raise_for_status()
            conclusion = resp.json()["choices"][0]["message"]["content"]
            score = 85
        except (KeyError, IndexError, ValueError, requests.RequestException):
            conclusion = f"{fallback} DeepSeek 暂时不可用，已返回本地监管提示。"
    return ok({
        "product_id": product.id,
        "score": score,
        "conclusion": conclusion,
        "created_at": beijing_now().isoformat(),
    }, "AI 监管完成")


@main_bp.post("/ai/chat/<int:product_id>")
@login_required("user", "merchant", "admin")
def ai_chat(user, product_id):
    product = Product.query.get_or_404(product_id)
    data, error = validate_json(AiChatSchema)
    if error:
        return error
    question = data.question
    if not current_app.config["DEEPSEEK_API_KEY"]:
        return ok({"answer": f"关于 {product.name}：可重点查看产地、库存、储存条件和商家类型。当前未配置 DeepSeek API Key。"})
    try:
        resp = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {current_app.config['DEEPSEEK_API_KEY']}"},
            json={"model": "deepseek-chat", "messages": [{"role": "system", "content": "你是农产品电商客服。"}, {"role": "user", "content": f"商品：{product.to_card()}。问题：{question}"}]},
            timeout=20,
        )
        resp.raise_for_status()
        answer = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError, requests.RequestException):
        answer = f"关于 {product.name}：AI 服务暂时不可用。你仍可查看商品产地、库存、储存条件，并联系商家客服。"
    return ok({"answer": answer})


@main_bp.get("/admin/summary")
@login_required("admin")
def admin_summary(user):
    days = range_days(request.args.get("range"))
    buyers = Account.query.filter_by(role="user").order_by(Account.created_at.desc()).all()
    merchant_shops = Shop.query.filter_by(type="merchant").order_by(Shop.created_at.desc()).all()
    products = Product.query.order_by(Product.created_at.desc()).all()
    orders = Order.query.order_by(Order.created_at.desc()).all()
    paid_orders = [order for order in orders if order.status in ORDER_SETTLED_STATUSES]
    today = beijing_now().date()
    start = today - timedelta(days=days - 1)
    growth = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        growth.append({
            "date": day.isoformat(),
            "users": Account.query.filter(Account.role == "user", Account.created_at < day + timedelta(days=1)).count(),
            "shops": Shop.query.filter(Shop.type == "merchant", Shop.created_at < day + timedelta(days=1)).count(),
        })
    return ok({
        "users": len(buyers),
        "shops": len(merchant_shops),
        "products": Product.query.filter_by(status="on_sale").count(),
        "orders": len(orders),
        "sales": sum(float(order.total_amount or 0) for order in paid_orders),
        "buyers": [item.public_dict() for item in buyers],
        "merchant_shops": [{
            **shop.to_dict(),
            "owner": shop.owner.public_dict() if shop.owner else None,
        } for shop in merchant_shops],
        "product_list": [item.to_card() for item in products],
        "order_list": [{
            **item.detail_dict(),
            "user": item.user.public_dict() if item.user else None,
        } for item in orders],
        "sales_chart": sales_series(Order.query, days),
        "growth_chart": growth,
    })


@main_bp.get("/admin/system-logs")
@login_required("admin")
def admin_system_logs(user):
    query = SystemLog.query
    keyword = (request.args.get("keyword") or "").strip()
    actor_role = (request.args.get("actor_role") or "").strip()
    action = (request.args.get("action") or "").strip()
    target_type = (request.args.get("target_type") or "").strip()
    if keyword:
        query = query.filter(or_(
            SystemLog.actor_username.contains(keyword),
            SystemLog.action.contains(keyword),
            SystemLog.target_type.contains(keyword),
            SystemLog.detail.contains(keyword),
        ))
    if action:
        query = query.filter_by(action=action)
    if target_type:
        query = query.filter_by(target_type=target_type)
    if actor_role:
        if actor_role == "system":
            query = query.filter(SystemLog.actor_role.is_(None))
        else:
            query = query.filter_by(actor_role=actor_role)
    return ok(page_query(query.order_by(SystemLog.created_at.desc()), lambda item: item.detail_dict()))


@main_bp.delete("/admin/system-logs/<int:log_id>")
@login_required("admin")
def delete_system_log(user, log_id):
    item = SystemLog.query.get_or_404(log_id)
    db.session.delete(item)
    write_log(user, "delete_system_log", "system_log", log_id, "管理员删除单条系统日志")
    db.session.commit()
    return ok(True, "系统日志已删除")


@main_bp.delete("/admin/system-logs")
@login_required("admin")
def clear_system_logs(user):
    count = SystemLog.query.delete(synchronize_session=False)
    write_log(user, "clear_system_logs", "system_log", None, f"管理员清空系统日志 {count} 条")
    db.session.commit()
    return ok({"deleted": count}, "系统日志已清空")


@main_bp.put("/admin/accounts/<int:account_id>/status")
@login_required("admin")
def admin_account_status(user, account_id):
    account = Account.query.get_or_404(account_id)
    if account.role == "admin":
        return fail("不能修改自营管理员账号状态", 403)
    data, error = validate_json(StatusSchema)
    if error:
        return error
    status = data.status
    if status not in {"active", "disabled"}:
        return fail("账号状态不合法")
    account.status = status
    db.session.commit()
    return ok(account.public_dict(), "账号状态已更新")


@main_bp.put("/admin/shops/<int:shop_id>/status")
@login_required("admin")
def admin_shop_status(user, shop_id):
    shop = Shop.query.get_or_404(shop_id)
    if shop.type == "self":
        return fail("自营店铺不能在商家列表中封禁", 403)
    data, error = validate_json(StatusSchema)
    if error:
        return error
    status = data.status
    if status not in {"active", "disabled"}:
        return fail("店铺状态不合法")
    shop.status = status
    db.session.commit()
    return ok(shop.to_dict(), "店铺状态已更新")


@main_bp.put("/admin/products/<int:product_id>/status")
@login_required("admin")
def admin_product_status(user, product_id):
    product = Product.query.get_or_404(product_id)
    data, error = validate_json(StatusSchema)
    if error:
        return error
    status = data.status
    if status not in {"on_sale", "off_sale", "disabled"}:
        return fail("商品状态不合法")
    product.status = status
    db.session.commit()
    return ok(product.to_card(), "商品状态已更新")
