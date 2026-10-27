from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, clear_session_cookie, set_session_cookie
from app.db import get_db
from app.models import User
from app.schemas import LoginIn, UserOut

router = APIRouter(tags=["auth"])


@router.get("/auth/users", response_model=list[UserOut])
def list_demo_users(db: Annotated[Session, Depends(get_db)]):
    """Public list of seeded accounts, used by the login screen's user picker."""
    return db.scalars(select(User).order_by(User.name)).all()


@router.post("/auth/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Annotated[Session, Depends(get_db)]):
    """Mocked auth for the exercise: any seeded email signs in without a password."""
    user = db.scalar(select(User).where(User.email == body.email))
    if not user:
        raise HTTPException(status_code=401, detail="No account with that email")
    set_session_cookie(response, user.id)
    return user


@router.post("/auth/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
