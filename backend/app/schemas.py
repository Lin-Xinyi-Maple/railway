from typing import Literal
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def normalize_email(value: str):
    email = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("invalid email")
    return email


class SendCodeSchema(StrictModel):
    email: str = Field(min_length=3, max_length=120)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return normalize_email(value)


class RegisterSchema(StrictModel):
    role: Literal["user", "merchant", "admin"] = "user"
    username: str = Field(min_length=1, max_length=80)
    nickname: str | None = Field(default=None, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    email_code: str | None = Field(default=None, max_length=12)
    admin_invite_code: str | None = Field(default=None, max_length=80)
    avatar: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return normalize_email(value)


class ResetPasswordSchema(StrictModel):
    email: str = Field(min_length=3, max_length=120)
    email_code: str = Field(min_length=1, max_length=12)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return normalize_email(value)


class LoginSchema(StrictModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class RefreshTokenSchema(StrictModel):
    refresh_token: str = Field(min_length=20)


class ProductQuerySchema(StrictModel):
    keyword: str | None = Field(default=None, max_length=160)
    category_id: int | None = None
    shop_type: Literal["", "self", "merchant"] | None = None
    sort: Literal["", "newest", "oldest", "paid_users", "comments", "price_asc", "price_desc"] | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)

    @field_validator("keyword", "shop_type", "sort")
    @classmethod
    def empty_to_none(cls, value):
        return None if value == "" else value


class ProfileSchema(StrictModel):
    nickname: str = Field(min_length=1, max_length=80)
    avatar: str | None = Field(default=None, max_length=255)


class UpdateEmailSchema(StrictModel):
    new_email: str = Field(min_length=3, max_length=120)
    old_email_code: str = Field(min_length=1, max_length=12)
    new_email_code: str = Field(min_length=1, max_length=12)

    @field_validator("new_email")
    @classmethod
    def normalize_email(cls, value):
        return normalize_email(value)


class UpdatePasswordSchema(StrictModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class EmailCodeSchema(StrictModel):
    email_code: str = Field(min_length=1, max_length=12)


class CategorySchema(StrictModel):
    name: str = Field(min_length=1, max_length=80)


class ProductPayloadSchema(StrictModel):
    shop_id: int | None = None
    category_id: int | None = None
    name: str | None = Field(default=None, max_length=160)
    main_image: str | None = Field(default=None, max_length=255)
    image_2: str | None = Field(default=None, max_length=255)
    image_3: str | None = Field(default=None, max_length=255)
    detail: str | None = None
    price: float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=20)
    stock: int | None = Field(default=None, ge=0)
    warning_stock: int | None = Field(default=None, ge=0)
    origin: str | None = Field(default=None, max_length=120)
    planting_method: str | None = Field(default=None, max_length=120)
    shelf_life_days: int | None = Field(default=None, ge=0)
    storage_condition: str | None = Field(default=None, max_length=160)
    status: Literal["on_sale", "off_sale", "disabled"] | None = None

    def present_fields(self):
        return self.model_dump(exclude_unset=True)


class ShopPayloadSchema(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    shipping_address: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=30)


class ShopUpdateSchema(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    shipping_address: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=1, max_length=30)


class RestockSchema(StrictModel):
    quantity: int = Field(gt=0)


class CartAddSchema(StrictModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)


class AddressSchema(StrictModel):
    receiver_name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=1, max_length=30)
    province: str = Field(min_length=1, max_length=50)
    city: str = Field(min_length=1, max_length=50)
    district: str = Field(min_length=1, max_length=50)
    detail: str = Field(min_length=1, max_length=255)
    is_default: bool = False


class AddressUpdateSchema(StrictModel):
    receiver_name: str | None = Field(default=None, min_length=1, max_length=60)
    phone: str | None = Field(default=None, min_length=1, max_length=30)
    province: str | None = Field(default=None, min_length=1, max_length=50)
    city: str | None = Field(default=None, min_length=1, max_length=50)
    district: str | None = Field(default=None, min_length=1, max_length=50)
    detail: str | None = Field(default=None, min_length=1, max_length=255)
    is_default: bool | None = None


class OrderCreateSchema(StrictModel):
    product_id: int
    address_id: int | None = None
    quantity: int = Field(default=1, ge=1)


class PayOrderSchema(StrictModel):
    address_id: int
    payment_method: str = Field(min_length=1, max_length=40)


class CommentCreateSchema(StrictModel):
    product_id: int
    rating: int = Field(default=10, ge=1, le=10)
    content: str = Field(min_length=1)
    image_url: str | None = Field(default=None, max_length=255)


class ReplySchema(StrictModel):
    reply: str = Field(min_length=1)


class ComplaintSchema(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1)
    phone: str = Field(min_length=1, max_length=30)
    image1: str | None = Field(default=None, max_length=255)
    image2: str | None = Field(default=None, max_length=255)
    image3: str | None = Field(default=None, max_length=255)


class MessageReadSchema(StrictModel):
    thread_key: Literal["system"] | None = None
    sender_id: int | None = None


class SystemMessageSchema(StrictModel):
    content: str = ""
    image_url: str | None = Field(default=None, max_length=255)

    @field_validator("content")
    @classmethod
    def keep_text(cls, value):
        return value.strip()


class SendMessageSchema(SystemMessageSchema):
    receiver_id: int


class AdminMessageSchema(SystemMessageSchema):
    target_mode: Literal["all_users", "all_merchants", "selected"]
    receiver_emails: list[str] = Field(default_factory=list)

    @field_validator("receiver_emails")
    @classmethod
    def normalize_emails(cls, value):
        return [normalize_email(item) for item in value]


class FriendInviteSchema(StrictModel):
    email: str = Field(min_length=3, max_length=120)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return normalize_email(value)


class AiChatSchema(StrictModel):
    question: str = Field(default="", max_length=500)


class StatusSchema(StrictModel):
    status: str = Field(min_length=1, max_length=30)
