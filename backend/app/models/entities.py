from datetime import datetime

from sqlalchemy.orm import validates
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..time_utils import beijing_now

ORDER_SETTLED_STATUSES = ("待收货", "已收货", "售后中", "完成售后")
ORDER_REVIEWABLE_STATUSES = ("已收货", "售后中", "完成售后")


class SerializerMixin:
    def to_dict(self):
        data = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            data[column.name] = value.isoformat() if isinstance(value, datetime) else value
        return data


class Account(db.Model, SerializerMixin):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    nickname = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    avatar = db.Column(db.String(255))
    role = db.Column(db.Enum("user", "merchant", "admin"), nullable=False, default="user")
    status = db.Column(db.Enum("active", "disabled"), nullable=False, default="active")
    last_login_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=beijing_now)

    shops = db.relationship("Shop", backref="owner", cascade="all, delete-orphan")
    cart_items = db.relationship("CartItem", backref="user", cascade="all, delete-orphan")
    addresses = db.relationship("Address", backref="user", cascade="all, delete-orphan")
    orders = db.relationship("Order", backref="user", cascade="all, delete-orphan")
    comments = db.relationship("Comment", backref="user", cascade="all, delete-orphan")
    favorites = db.relationship("Favorite", backref="user", cascade="all, delete-orphan")
    complaints = db.relationship("Complaint", back_populates="complainant", cascade="all, delete-orphan")
    sent_messages = db.relationship(
        "Message",
        foreign_keys="Message.sender_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    received_messages = db.relationship(
        "Message",
        foreign_keys="Message.receiver_id",
        back_populates="receiver",
        cascade="all, delete-orphan",
    )
    sent_friends = db.relationship(
        "Friend",
        foreign_keys="Friend.applicant_id",
        backref="applicant",
        cascade="all, delete-orphan",
    )
    received_friends = db.relationship(
        "Friend",
        foreign_keys="Friend.receiver_id",
        backref="receiver",
        cascade="all, delete-orphan",
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def public_dict(self):
        data = self.to_dict()
        data.pop("password_hash", None)
        return data


class Category(db.Model, SerializerMixin):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    products = db.relationship("Product", backref="category", cascade="all, delete-orphan")


class Shop(db.Model, SerializerMixin):
    __tablename__ = "shops"

    id = db.Column(db.Integer, primary_key=True)
    owner_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False, index=True)
    description = db.Column(db.Text)
    type = db.Column(db.Enum("merchant", "self"), nullable=False, default="merchant")
    status = db.Column(db.Enum("active", "disabled"), nullable=False, default="active")
    shipping_address = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=beijing_now)

    products = db.relationship("Product", backref="shop", cascade="all, delete-orphan")
    orders = db.relationship("Order", backref="shop", cascade="all, delete-orphan")


class Product(db.Model, SerializerMixin):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    shop_id = db.Column(db.Integer, db.ForeignKey("shops.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False, index=True)
    main_image = db.Column(db.String(255))
    image_2 = db.Column(db.String(255))
    image_3 = db.Column(db.String(255))
    detail = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    unit = db.Column(db.String(20), nullable=False, default="斤")
    stock = db.Column(db.Integer, nullable=False, default=0)
    warning_stock = db.Column(db.Integer, nullable=False, default=10)
    origin = db.Column(db.String(120))
    planting_method = db.Column(db.String(120))
    shelf_life_days = db.Column(db.Integer)
    storage_condition = db.Column(db.String(160))
    status = db.Column(db.Enum("on_sale", "off_sale", "disabled"), nullable=False, default="on_sale")
    created_at = db.Column(db.DateTime, default=beijing_now)

    cart_items = db.relationship("CartItem", backref="product", cascade="all, delete-orphan")
    orders = db.relationship("Order", backref="product", cascade="all, delete-orphan")
    comments = db.relationship("Comment", backref="product", cascade="all, delete-orphan")
    favorites = db.relationship("Favorite", back_populates="product", cascade="all, delete-orphan")

    def to_card(self):
        data = self.to_dict()
        data["price"] = float(self.price)
        data["category_name"] = self.category.name if self.category else ""
        data["shop_name"] = self.shop.name if self.shop else ""
        data["shop_type"] = self.shop.type if self.shop else ""
        data["merchant_account_id"] = self.shop.owner_account_id if self.shop else None
        data["order_users_count"] = len({order.user_id for order in self.orders})
        data["paid_users_count"] = len({order.user_id for order in self.orders if order.status in ORDER_SETTLED_STATUSES})
        data["comment_count"] = len(self.comments)
        return data


class CartItem(db.Model, SerializerMixin):
    __tablename__ = "cart_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=beijing_now)


class Address(db.Model, SerializerMixin):
    __tablename__ = "addresses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    receiver_name = db.Column(db.String(60), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    province = db.Column(db.String(50), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    district = db.Column(db.String(50), nullable=False)
    detail = db.Column(db.String(255), nullable=False)
    is_default = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=beijing_now)

    orders = db.relationship("Order", back_populates="address")

    @property
    def full_address(self):
        return f"{self.province}{self.city}{self.district}{self.detail}"


class Order(db.Model, SerializerMixin):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(40), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey("shops.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    address_id = db.Column(db.Integer, db.ForeignKey("addresses.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=beijing_now)
    paid_at = db.Column(db.DateTime)
    payment_method = db.Column(db.String(40))
    is_visible = db.Column(db.Boolean, nullable=False, default=True)
    status = db.Column(
        db.Enum("待付款", "待收货", "已收货", "售后中", "完成售后"),
        nullable=False,
        default="待付款",
    )

    address = db.relationship("Address", back_populates="orders")

    def detail_dict(self):
        data = self.to_dict()
        data["unit_price"] = float(self.unit_price)
        data["total_amount"] = float(self.total_amount)
        data["product"] = self.product.to_card() if self.product else None
        data["shop"] = self.shop.to_dict() if self.shop else None
        data["address"] = self.address.to_dict() if self.address else None
        if self.address:
            data["receiver_full_address"] = self.address.full_address
        return data


class Comment(db.Model, SerializerMixin):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(255))
    merchant_reply = db.Column(db.Text)
    merchant_replied_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=beijing_now)


class Complaint(db.Model, SerializerMixin):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    complainant_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image1 = db.Column(db.String(255))
    image2 = db.Column(db.String(255))
    image3 = db.Column(db.String(255))
    phone = db.Column(db.String(30), nullable=False)
    is_processed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=beijing_now)

    complainant = db.relationship("Account", back_populates="complaints")

    def detail_dict(self):
        data = self.to_dict()
        data["complainant"] = self.complainant.public_dict() if self.complainant else None
        return data


class Message(db.Model, SerializerMixin):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("accounts.id"))
    receiver_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(40), nullable=False, default="system")
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    link_url = db.Column(db.String(255))
    image_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=beijing_now)

    sender = db.relationship("Account", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = db.relationship("Account", foreign_keys=[receiver_id], back_populates="received_messages")

    @validates("type")
    def validate_type(self, key, value):
        allowed_types = {"system", "system_chat", "chat"}
        if value not in allowed_types:
            raise ValueError(f"message type must be one of {', '.join(sorted(allowed_types))}")
        return value

    def detail_dict(self):
        data = self.to_dict()
        data["sender"] = self.sender.public_dict() if self.sender else None
        data["receiver"] = self.receiver.public_dict() if self.receiver else None
        return data


class Favorite(db.Model, SerializerMixin):
    __tablename__ = "favorites"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=beijing_now)

    product = db.relationship("Product", back_populates="favorites")


class Friend(db.Model, SerializerMixin):
    __tablename__ = "friends"
    __table_args__ = (
        db.UniqueConstraint("applicant_id", "receiver_id", name="uq_friend_applicant_receiver"),
    )

    id = db.Column(db.Integer, primary_key=True)
    applicant_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False, index=True)
    is_accepted = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=beijing_now)
    accepted_at = db.Column(db.DateTime)

    def detail_dict(self, current_user_id=None):
        data = self.to_dict()
        data["applicant"] = self.applicant.public_dict() if self.applicant else None
        data["receiver"] = self.receiver.public_dict() if self.receiver else None
        if current_user_id:
            other = self.receiver if self.applicant_id == current_user_id else self.applicant
            data["other"] = other.public_dict() if other else None
            data["direction"] = "sent" if self.applicant_id == current_user_id else "received"
        return data


class SystemLog(db.Model, SerializerMixin):
    __tablename__ = "system_logs"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), index=True)
    actor_username = db.Column(db.String(80))
    actor_role = db.Column(db.String(30))
    action = db.Column(db.String(80), nullable=False, index=True)
    target_type = db.Column(db.String(80), nullable=False, index=True)
    target_id = db.Column(db.Integer, index=True)
    detail = db.Column(db.Text)
    ip_address = db.Column(db.String(60))
    created_at = db.Column(db.DateTime, default=beijing_now, index=True)

    actor = db.relationship("Account")

    def detail_dict(self):
        data = self.to_dict()
        data["actor"] = self.actor.public_dict() if self.actor else None
        return data
