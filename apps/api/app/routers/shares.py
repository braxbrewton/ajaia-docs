from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access import Access, DocContext, require_doc
from app.db import get_db
from app.models import DocumentShare, User
from app.schemas import ShareCreate, ShareOut

router = APIRouter(prefix="/documents/{doc_id}/shares", tags=["sharing"])

DB = Annotated[Session, Depends(get_db)]
OwnerCtx = Annotated[DocContext, Depends(require_doc(Access.owner))]


@router.get("", response_model=list[ShareOut])
def list_shares(ctx: OwnerCtx):
    return [ShareOut(user=s.user, role=s.role) for s in ctx.doc.shares]


@router.post("", response_model=ShareOut, status_code=201)
def share_document(body: ShareCreate, ctx: OwnerCtx, db: DB):
    """Grant access (or change the role if already shared). Owner only."""
    target = db.scalar(select(User).where(User.email == body.email))
    if not target:
        raise HTTPException(status_code=404, detail="No user with that email")
    if target.id == ctx.doc.owner_id:
        raise HTTPException(status_code=400, detail="You already own this document")

    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == ctx.doc.id, DocumentShare.user_id == target.id
        )
    )
    if share:
        share.role = body.role
    else:
        share = DocumentShare(document_id=ctx.doc.id, user_id=target.id, role=body.role)
        db.add(share)
    db.commit()
    db.refresh(share)
    return ShareOut(user=target, role=share.role)


@router.delete("/{user_id}", status_code=204)
def revoke_share(user_id: str, ctx: OwnerCtx, db: DB):
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == ctx.doc.id, DocumentShare.user_id == user_id
        )
    )
    if not share:
        raise HTTPException(status_code=404, detail="That user does not have access")
    db.delete(share)
    db.commit()
