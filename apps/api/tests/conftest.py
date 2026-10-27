from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.seed import seed


@pytest.fixture()
def session_factory() -> Iterator[sessionmaker]:
    """Fresh in-memory SQLite DB per test, seeded with the demo users."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        seed(db)
    yield factory
    engine.dispose()


@pytest.fixture()
def make_client(session_factory):
    """Returns a factory that builds an API client, optionally already logged in as `email`.

    Each client has its own cookie jar, so tests can act as several users at once.
    """

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    clients: list[TestClient] = []

    def _make(email: str | None = None) -> TestClient:
        c = TestClient(app)
        clients.append(c)
        if email:
            r = c.post("/auth/login", json={"email": email})
            assert r.status_code == 200, r.text
        return c

    yield _make
    for c in clients:
        c.close()
    app.dependency_overrides.clear()


ALICE = "alice@ajaia.test"
BOB = "bob@ajaia.test"
CAROL = "carol@ajaia.test"


@pytest.fixture()
def alice(make_client):
    return make_client(ALICE)


@pytest.fixture()
def bob(make_client):
    return make_client(BOB)


@pytest.fixture()
def carol(make_client):
    return make_client(CAROL)
