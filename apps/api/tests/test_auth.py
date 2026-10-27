from tests.conftest import ALICE


def test_login_sets_session_and_me_works(make_client):
    c = make_client()
    assert c.get("/me").status_code == 401
    r = c.post("/auth/login", json={"email": ALICE.upper()})  # case-insensitive
    assert r.status_code == 200
    assert r.json()["email"] == ALICE
    assert c.get("/me").json()["name"] == "Alice Anderson"


def test_login_unknown_email_rejected(make_client):
    r = make_client().post("/auth/login", json={"email": "nobody@ajaia.test"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "http_401"


def test_login_invalid_email_is_validation_error(make_client):
    r = make_client().post("/auth/login", json={"email": "not-an-email"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_logout_clears_session(make_client):
    c = make_client(ALICE)
    assert c.post("/auth/logout").status_code == 204
    assert c.get("/me").status_code == 401


def test_demo_user_list_is_public(make_client):
    r = make_client().get("/auth/users")
    assert r.status_code == 200
    assert {u["email"] for u in r.json()} >= {ALICE}


def test_documents_require_login(make_client):
    assert make_client().get("/documents").status_code == 401
