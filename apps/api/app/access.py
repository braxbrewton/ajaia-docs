"""Single source of truth for who can do what on a document.

Roles, lowest to highest: viewer < editor < owner.
Documents the caller cannot see at all return 404 (not 403) so their existence is not leaked.
A caller who can see a document but lacks the needed role gets 403.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.models import Document, DocumentShare, ShareRole, User


class Access(StrEnum):
    viewer = "viewer"
    editor = "editor"
    owner = "owner"


_RANK = {Access.viewer: 1, Access.editor: 2, Access.owner: 3}


def get_access(db: Session, user: User, doc: Document) -> Access | None:
    if doc.owner_id == user.id:
        return Access.owner
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == doc.id, DocumentShare.user_id == user.id
        )
    )
    if share is None:
        return None
    return Access.editor if share.role == ShareRole.editor else Access.viewer


@dataclass
class DocContext:
    doc: Document
    access: Access
    user: User


def require_doc(min_access: Access):
    """FastAPI dependency factory: load `doc_id` from the path and enforce a minimum role."""

    def dependency(
        doc_id: str, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
    ) -> DocContext:
        doc = db.get(Document, doc_id)
        access = get_access(db, user, doc) if doc else None
        if doc is None or access is None:
            raise HTTPException(status_code=404, detail="Document not found")
        if _RANK[access] < _RANK[min_access]:
            raise HTTPException(
                status_code=403, detail=f"You need {min_access.value} access to do this"
            )
        return DocContext(doc=doc, access=access, user=user)

    return dependency
