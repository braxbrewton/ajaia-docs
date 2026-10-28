import pytest

from app.config import Settings


@pytest.mark.parametrize(
    "given, expected",
    [
        ("postgres://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        (
            "postgresql://u:p@host/db?sslmode=require",
            "postgresql+psycopg://u:p@host/db?sslmode=require",
        ),
        (
            "postgresql+psycopg://u:p@host/db",
            "postgresql+psycopg://u:p@host/db",
        ),  # already explicit
        ("sqlite:///./ajaia.db", "sqlite:///./ajaia.db"),
    ],
)
def test_database_url_gets_psycopg_driver(given, expected):
    assert Settings(database_url=given).database_url == expected
