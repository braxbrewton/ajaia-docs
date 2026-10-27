from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.access import Access, DocContext, require_doc
from app.auth import CurrentUser
from app.db import get_db
from app.models import Document, DocumentShare
from app.schemas import (
    DocumentCreate,
    DocumentList,
    DocumentOut,
    DocumentSummary,
    DocumentUpdate,
    ShareOut,
)
from app.services.sanitize import sanitize_html

router = APIRouter(prefix="/documents", tags=["documents"])

DB = Annotated[Session, Depends(get_db)]


def _to_out(ctx: DocContext) -> DocumentOut:
    doc = ctx.doc
    shares = (
        [ShareOut(user=s.user, role=s.role) for s in doc.shares]
        if ctx.access == Access.owner
        else []
    )
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        owner=doc.owner,
        role=ctx.access,
        can_edit=ctx.access in (Access.owner, Access.editor),
        shares=shares,
    )


@router.get("", response_model=DocumentList)
def list_documents(user: CurrentUser, db: DB):
    owned_docs = db.scalars(
        select(Document)
        .where(Document.owner_id == user.id)
        .options(joinedload(Document.owner))
        .order_by(Document.updated_at.desc())
    ).all()
    shared_rows = db.execute(
        select(Document, DocumentShare.role)
        .join(DocumentShare, DocumentShare.document_id == Document.id)
        .where(DocumentShare.user_id == user.id)
        .options(joinedload(Document.owner))
        .order_by(Document.updated_at.desc())
    ).all()

    def summary(doc: Document, role: Access) -> DocumentSummary:
        return DocumentSummary(
            id=doc.id,
            title=doc.title,
            updated_at=doc.updated_at,
            owner=doc.owner,
            role=role,
        )

    return DocumentList(
        owned=[summary(d, Access.owner) for d in owned_docs],
        shared=[summary(d, Access(role.value)) for d, role in shared_rows],
    )


@router.post("", response_model=DocumentOut, status_code=201)
def create_document(body: DocumentCreate, user: CurrentUser, db: DB):
    doc = Document(
        title=body.title, content=sanitize_html(body.content), owner_id=user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _to_out(DocContext(doc=doc, access=Access.owner, user=user))


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(ctx: Annotated[DocContext, Depends(require_doc(Access.viewer))]):
    return _to_out(ctx)


@router.patch("/{doc_id}", response_model=DocumentOut)
def update_document(
    body: DocumentUpdate,
    ctx: Annotated[DocContext, Depends(require_doc(Access.editor))],
    db: DB,
):
    if body.title is not None:
        ctx.doc.title = body.title
    if body.content is not None:
        ctx.doc.content = sanitize_html(body.content)
    db.commit()
    db.refresh(ctx.doc)
    return _to_out(ctx)


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    ctx: Annotated[DocContext, Depends(require_doc(Access.owner))], db: DB
):
    db.delete(ctx.doc)
    db.commit()
