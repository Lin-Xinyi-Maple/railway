from app.extensions import verification_codes


def test_register_requires_valid_payload(client):
    response = client.post("/api/auth/register", json={"username": "u"})

    assert response.status_code == 422
    assert response.get_json()["message"] == "请求参数不合法"


def test_register_login_and_refresh_token(client, app):
    with app.app_context():
        verification_codes.set("buyer@example.com", "123456")

    response = client.post("/api/auth/register", json={
        "role": "user",
        "username": "buyer",
        "nickname": "买家",
        "email": "buyer@example.com",
        "email_code": "123456",
        "password": "secret123",
    })
    body = response.get_json()["data"]

    assert response.status_code == 201
    assert body["token"]
    assert body["refresh_token"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": body["refresh_token"]})
    refresh_body = refresh_response.get_json()["data"]

    assert refresh_response.status_code == 200
    assert refresh_body["token"]
    assert refresh_body["refresh_token"]


def test_refresh_rejects_access_token(client, app):
    with app.app_context():
        verification_codes.set("buyer@example.com", "123456")
    response = client.post("/api/auth/register", json={
        "role": "user",
        "username": "buyer",
        "nickname": "买家",
        "email": "buyer@example.com",
        "email_code": "123456",
        "password": "secret123",
    })
    access_token = response.get_json()["data"]["token"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": access_token})

    assert refresh_response.status_code == 401


def test_register_normalizes_email(client, app):
    with app.app_context():
        verification_codes.set("buyer@example.com", "123456")

    response = client.post("/api/auth/register", json={
        "role": "user",
        "username": "buyer",
        "nickname": "买家",
        "email": "Buyer@Example.COM",
        "email_code": "123456",
        "password": "secret123",
    })

    assert response.status_code == 201
    assert response.get_json()["data"]["user"]["email"] == "buyer@example.com"


def test_admin_register_uses_default_invite_code(client):
    response = client.post("/api/auth/register", json={
        "role": "admin",
        "username": "admin",
        "nickname": "自营",
        "email": "admin@example.com",
        "admin_invite_code": "000000",
        "password": "secret123",
    })

    body = response.get_json()["data"]

    assert response.status_code == 201
    assert body["user"]["role"] == "admin"


def test_send_code_rejects_invalid_email(client):
    response = client.post("/api/auth/send-code", json={"email": "not-an-email"})

    assert response.status_code == 422
