def test_products_reject_invalid_query(client):
    response = client.get("/api/products?category_id=abc")

    assert response.status_code == 422
    assert response.get_json()["message"] == "查询参数不合法"


def test_products_sort_by_comments(client, sample_catalog):
    response = client.get("/api/products?sort=comments&page_size=10")
    items = response.get_json()["data"]["items"]

    assert response.status_code == 200
    assert items[0]["name"] == "车厘子"
    assert items[0]["comment_count"] == 1


def test_products_sort_by_price(client, sample_catalog):
    response = client.get("/api/products?sort=price_asc&page_size=10")
    items = response.get_json()["data"]["items"]

    assert response.status_code == 200
    assert [item["name"] for item in items] == ["苹果", "车厘子"]
