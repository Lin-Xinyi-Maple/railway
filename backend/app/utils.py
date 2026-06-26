from functools import wraps
from datetime import datetime, timedelta, timezone
import jwt
from flask import current_app, jsonify, request
from pydantic import ValidationError

from .extensions import db
from .models.entities import Account, Shop


def ok(data=None, message="success", status=200):
    return jsonify({"data": data, "message": message, "error": None}), status


def fail(message="request failed", status=400, error=None):
    return jsonify({"data": None, "message": message, "error": error or message}), status


def make_token(account, token_type="access"):
    expires_days = (
        current_app.config["JWT_REFRESH_TOKEN_EXPIRES_DAYS"]
        if token_type == "refresh"
        else current_app.config["JWT_ACCESS_TOKEN_EXPIRES_DAYS"]
    )
    payload = {
        "sub": str(account.id),
        "role": account.role,
        "type": token_type,
        "exp": datetime.now(timezone.utc) + timedelta(days=expires_days),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def make_auth_tokens(account):
    access_token = make_token(account, "access")
    refresh_token = make_token(account, "refresh")
    return {
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in_days": current_app.config["JWT_ACCESS_TOKEN_EXPIRES_DAYS"],
    }


def current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:], current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
        account_id = int(payload.get("sub"))
    except (TypeError, ValueError, jwt.PyJWTError):
        return None
    if payload.get("type", "access") != "access":
        return None
    return db.session.get(Account, account_id)


def decode_refresh_token(token):
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
        account_id = int(payload.get("sub"))
    except (TypeError, ValueError, jwt.PyJWTError):
        return None
    if payload.get("type") != "refresh":
        return None
    return db.session.get(Account, account_id)


def account_can_authenticate(account):
    if not account or account.status != "active":
        return False
    if account.role == "merchant" and Shop.query.filter_by(owner_account_id=account.id, status="disabled").first():
        return False
    return True


def login_required(*roles):
    def outer(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            user = current_user()
            if not user:
                return fail("请先登录", 401)
            if not account_can_authenticate(user):
                return fail("账号不可用", 403)
            if roles and user.role not in roles:
                return fail("权限不足", 403)
            return fn(user, *args, **kwargs)

        return inner

    return outer


def page_query(query, serializer):
    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = min(max(int(request.args.get("page_size", 10)), 1), 100)
    except (TypeError, ValueError):
        page = 1
        page_size = 10
    result = query.paginate(page=page, per_page=page_size, error_out=False)
    return {
        "items": [serializer(item) for item in result.items],
        "total": result.total,
        "page": page,
        "page_size": page_size,
        "pages": result.pages,
    }


def validation_errors(exc):
    errors = exc.errors()
    for item in errors:
        ctx = item.get("ctx")
        if ctx:
            item["ctx"] = {key: str(value) for key, value in ctx.items()}
    return errors


def validate_json(schema_cls):
    try:
        payload = request.get_json(silent=True) or {}
        return schema_cls.model_validate(payload), None
    except ValidationError as exc:
        return None, fail("请求参数不合法", 422, validation_errors(exc))


def validate_query(schema_cls):
    try:
        return schema_cls.model_validate(request.args.to_dict()), None
    except ValidationError as exc:
        return None, fail("查询参数不合法", 422, validation_errors(exc))
