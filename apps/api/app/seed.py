"""Seed demo users. Idempotent: safe to run on every deploy."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models import User

SEED_USERS = [
    ("alice@ajaia.test", "Alice Anderson"),
    ("bob@ajaia.test", "Bob Brown"),
    ("carol@ajaia.test", "Carol Chen"),
]


def seed(db: Session) -> None:
    for email, name in SEED_USERS:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(email=email, name=name))
    db.commit()


def main() -> None:
    Base.metadata.create_all(engine)  # dev convenience; Alembic owns prod schema
    with SessionLocal() as db:
        seed(db)
    print(f"Seeded {len(SEED_USERS)} users")


if __name__ == "__main__":
    main()
