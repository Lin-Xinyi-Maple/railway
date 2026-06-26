from flask import Blueprint, Response, jsonify


docs_bp = Blueprint("docs", __name__)


OPENAPI_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "鲜域农品电商系统 API",
        "version": "1.1.0",
        "description": "核心接口摘要，包含认证、商品推荐、购物车、订单、评论、投诉、消息、商家和自营管理入口。",
    },
    "servers": [{"url": "/api"}],
    "components": {
        "securitySchemes": {
            "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        },
        "schemas": {
            "ApiResponse": {
                "type": "object",
                "properties": {
                    "data": {"nullable": True},
                    "message": {"type": "string"},
                    "error": {"nullable": True},
                },
            },
            "LoginPayload": {
                "type": "object",
                "required": ["username", "password"],
                "properties": {"username": {"type": "string"}, "password": {"type": "string"}},
            },
            "RefreshPayload": {
                "type": "object",
                "required": ["refresh_token"],
                "properties": {"refresh_token": {"type": "string"}},
            },
            "ProductPayload": {
                "type": "object",
                "properties": {
                    "shop_id": {"type": "integer"},
                    "category_id": {"type": "integer"},
                    "name": {"type": "string"},
                    "price": {"type": "number"},
                    "stock": {"type": "integer"},
                    "status": {"type": "string", "enum": ["on_sale", "off_sale", "disabled"]},
                },
            },
        },
    },
    "paths": {
        "/health": {"get": {"summary": "健康检查", "responses": {"200": {"description": "API 正常"}}}},
        "/auth/send-code": {
            "post": {
                "summary": "发送邮箱验证码",
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["email"], "properties": {"email": {"type": "string"}}}}}},
                "responses": {"200": {"description": "验证码已生成并发送"}},
            }
        },
        "/auth/register": {"post": {"summary": "注册账号", "responses": {"201": {"description": "返回 access_token 与 refresh_token"}}}},
        "/auth/login": {
            "post": {
                "summary": "账号登录",
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/LoginPayload"}}}},
                "responses": {"200": {"description": "返回 access_token 与 refresh_token"}},
            }
        },
        "/auth/refresh": {
            "post": {
                "summary": "刷新 JWT",
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/RefreshPayload"}}}},
                "responses": {"200": {"description": "刷新成功"}, "401": {"description": "刷新令牌无效"}},
            }
        },
        "/auth/me": {"get": {"summary": "当前登录用户", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "用户信息"}}}},
        "/products": {
            "get": {
                "summary": "商品推荐列表",
                "parameters": [
                    {"name": "keyword", "in": "query", "schema": {"type": "string"}},
                    {"name": "category_id", "in": "query", "schema": {"type": "integer"}},
                    {"name": "shop_type", "in": "query", "schema": {"type": "string", "enum": ["self", "merchant"]}},
                    {"name": "sort", "in": "query", "schema": {"type": "string", "enum": ["newest", "oldest", "paid_users", "comments", "price_asc", "price_desc"]}},
                    {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                    {"name": "page_size", "in": "query", "schema": {"type": "integer", "default": 10}},
                ],
                "responses": {"200": {"description": "分页商品列表"}},
            },
            "post": {
                "summary": "创建商品",
                "security": [{"BearerAuth": []}],
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ProductPayload"}}}},
                "responses": {"201": {"description": "商品已发布"}},
            },
        },
        "/products/{product_id}": {
            "get": {"summary": "商品详情", "parameters": [{"name": "product_id", "in": "path", "required": True, "schema": {"type": "integer"}}], "responses": {"200": {"description": "商品详情"}}},
            "put": {"summary": "更新商品", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "商品已保存"}}},
            "delete": {"summary": "删除商品", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "商品已删除"}}},
        },
        "/cart": {"get": {"summary": "购物车", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "购物车列表"}}}, "post": {"summary": "加入购物车", "security": [{"BearerAuth": []}], "responses": {"201": {"description": "已加入购物车"}}}},
        "/orders": {"get": {"summary": "订单列表", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "订单分页"}}}, "post": {"summary": "创建订单", "security": [{"BearerAuth": []}], "responses": {"201": {"description": "订单已创建"}}}},
        "/comments": {"post": {"summary": "发布评论", "security": [{"BearerAuth": []}], "responses": {"201": {"description": "评论已发布"}}}},
        "/complaints": {"get": {"summary": "投诉与反馈列表", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "投诉列表"}}}, "post": {"summary": "提交投诉与反馈", "security": [{"BearerAuth": []}], "responses": {"201": {"description": "已提交"}}}},
        "/messages": {"get": {"summary": "消息列表", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "消息列表"}}}},
        "/admin/summary": {"get": {"summary": "自营管理总览", "security": [{"BearerAuth": []}], "responses": {"200": {"description": "后台汇总数据"}}}},
    },
}


@docs_bp.get("/openapi.json")
def openapi_json():
    return jsonify(OPENAPI_SPEC)


@docs_bp.get("")
def swagger_ui():
    html = """
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>鲜域农品 API 文档</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>
"""
    return Response(html, mimetype="text/html; charset=utf-8")
