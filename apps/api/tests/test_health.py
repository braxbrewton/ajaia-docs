from fastapi.testclient import TestClient

from app.main import app


def test_health():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_unknown_route_uses_error_shape():
    r = TestClient(app).get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "http_404"
