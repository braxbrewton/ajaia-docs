from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.access import Access, DocContext
from app.auth import CurrentUser
from app.config import get_settings
from app.db import get_db
from app.models import Document
from app.routers.documents import to_document_out
from app.schemas import MAX_CONTENT_CHARS, DocumentOut
from app.services.importer import ImportRejected, import_file

router = APIRouter(prefix="/documents", tags=["import"])


@router.post("/import", response_model=DocumentOut, status_code=201)
async def import_document(
    file: UploadFile, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
):
    """Create a new editable document from an uploaded .txt, .md or .docx file."""
    limit = get_settings().max_upload_bytes
    # Read one byte past the limit so oversized uploads are rejected without buffering them fully.
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large (max {limit // (1024 * 1024)} MB).",
        )

    try:
        imported = import_file(file.filename or "", data)
    except ImportRejected as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc

    if len(imported.html) > MAX_CONTENT_CHARS:
        raise HTTPException(
            status_code=413, detail="That file is too large to edit as a document."
        )

    doc = Document(title=imported.title, content=imported.html, owner_id=user.id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return to_document_out(DocContext(doc=doc, access=Access.owner, user=user))
