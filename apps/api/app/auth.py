from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User


def create_session_token(user_id: str) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(hours=s.session_hours)
    return jwt.encode(
        {"sub": user_id, "exp": exp}, s.jwt_secret, algorithm=s.jwt_algorithm
    )


def set_session_cookie(response: Response, user_id: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name,
        create_session_token(user_id),
        max_age=s.session_hours * 3600,
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    s = get_settings()
    token = request.cookies.get(s.cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401, detail="Session expired, please sign in again"
        )
    user = db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
