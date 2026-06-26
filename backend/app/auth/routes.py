from email.mime.text import MIMEText
import secrets
import smtplib
import requests

from flask import Blueprint, current_app

from ..extensions import db, verification_codes
from ..models.entities import Account, Message, Shop
from ..schemas import LoginSchema, RefreshTokenSchema, RegisterSchema, ResetPasswordSchema, SendCodeSchema
from ..time_utils import beijing_now
from ..utils import account_can_authenticate, current_user, decode_refresh_token, fail, make_auth_tokens, ok, validate_json

auth_bp = Blueprint("auth", __name__)


def send_code_email(email, code):
    if not current_app.config["SMTP_USERNAME"] or not current_app.config["SMTP_AUTH_CODE"]:
        return
    body = f"您的农产品电商系统邮箱验证码是：{code}，10 分钟内有效。"
    message = MIMEText(body, "plain", "utf-8")
    message["Subject"] = "邮箱验证码"
    message["From"] = current_app.config["SMTP_USERNAME"]
    message["To"] = email
    host = current_app.config["SMTP_HOST"]
    port = current_app.config["SMTP_PORT"]
    timeout = current_app.config["SMTP_TIMEOUT_SECONDS"]

    if current_app.config["SMTP_USE_STARTTLS"]:
        server = smtplib.SMTP(host, port, timeout=timeout)
        server.starttls()
    else:
        server = smtplib.SMTP_SSL(host, port, timeout=timeout)

    with server:
        server.login(current_app.config["SMTP_USERNAME"], current_app.config["SMTP_AUTH_CODE"])
        server.sendmail(current_app.config["SMTP_USERNAME"], [email], message.as_string())


@auth_bp.post("/send-code")
def send_code():
    payload, error = validate_json(SendCodeSchema)
    if error:
        return error
    email = payload.email
    code = f"{secrets.randbelow(900000) + 100000}"
    verification_codes.set(email, code)
    send_code_email(email, code)
    return ok({"email": email}, "验证码已发送")


@auth_bp.post("/register")
def register():
    data, error = validate_json(RegisterSchema)
    if error:
        return error
    role = data.role
    if Account.query.filter((Account.username == data.username) | (Account.email == data.email)).first():
        return fail("用户名或邮箱已存在", 409)
    if role in {"user", "merchant"} and verification_codes.get(data.email) != data.email_code:
        return fail("邮箱验证码错误")
    if role == "admin" and not current_app.config["ADMIN_INVITE_CODE"]:
        return fail("自营账号注册未开放", 403)
    if role == "admin" and data.admin_invite_code != current_app.config["ADMIN_INVITE_CODE"]:
        return fail("自营用户授权码错误", 403)
    if role == "admin" and Account.query.filter_by(role="admin").first():
        return fail("系统只能有一个自营账号", 409)

    account = Account(
        username=data.username,
        nickname=data.nickname or data.username,
        email=data.email,
        role=role,
        status="active",
        avatar=data.avatar,
    )
    account.set_password(data.password)
    db.session.add(account)
    db.session.flush()
    db.session.add(Message(receiver_id=account.id, title="欢迎加入", content="欢迎使用鲜域农品电商系统。"))
    db.session.commit()
    verification_codes.delete(data.email)
    return ok({**make_auth_tokens(account), "user": account.public_dict()}, "注册成功", 201)


@auth_bp.post("/reset-password")
def reset_password():
    data, error = validate_json(ResetPasswordSchema)
    if error:
        return error
    if verification_codes.get(data.email) != data.email_code:
        return fail("邮箱验证码错误")
    account = Account.query.filter_by(email=data.email).first()
    if not account:
        return fail("该邮箱未注册", 404)
    account.set_password(data.password)
    db.session.add(Message(receiver_id=account.id, title="密码已重置", content="您的账号密码已通过邮箱验证码重置。"))
    db.session.commit()
    verification_codes.delete(data.email)
    return ok(True, "密码已重置")


@auth_bp.post("/login")
def login():
    data, error = validate_json(LoginSchema)
    if error:
        return error
    account = Account.query.filter_by(username=data.username).first()
    if not account or not account.check_password(data.password):
        return fail("用户名或密码错误", 401)
    if account.status == "disabled":
        return fail("该账号异常，请与管理员联系", 403)
    if account.role == "merchant" and Shop.query.filter_by(owner_account_id=account.id, status="disabled").first():
        return fail("该账号异常，请与管理员联系", 403)
    account.last_login_at = beijing_now()
    db.session.commit()
    return ok({**make_auth_tokens(account), "user": account.public_dict()}, "登录成功")


@auth_bp.post("/refresh")
def refresh():
    data, error = validate_json(RefreshTokenSchema)
    if error:
        return error
    account = decode_refresh_token(data.refresh_token)
    if not account_can_authenticate(account):
        return fail("刷新令牌无效或已过期", 401)
    return ok({**make_auth_tokens(account), "user": account.public_dict()}, "Token 已刷新")


@auth_bp.get("/me")
def me():
    account = current_user()
    if not account:
        return fail("未登录", 401)
    return ok(account.public_dict())


@auth_bp.post("/logout")
def logout():
    return ok(True, "已退出登录")
