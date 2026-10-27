from datetime import UTC, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
)

from app.access import Access
from app.models import ShareRole

# Generous but bounded: ~2 MB of HTML. Keeps the DB and editor sane.
MAX_CONTENT_CHARS = 2_000_000

Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]

# Format-only check, normalized to lowercase. We deliberately don't use pydantic's EmailStr:
# it rejects reserved TLDs like ".test", which the seeded demo accounts use.
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]


def _as_utc(v: datetime) -> datetime:
    # SQLite drops tzinfo; everything we store is UTC, so make that explicit in API output.
    return v.replace(tzinfo=UTC) if v.tzinfo is None else v.astimezone(UTC)


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: str
    email: str
    name: str


class LoginIn(BaseModel):
    email: Email


class DocumentCreate(BaseModel):
    title: Title = "Untitled document"
    content: str = ""


class DocumentUpdate(BaseModel):
    title: Title | None = None
    content: str | None = None

    @field_validator("content")
    @classmethod
    def content_size(cls, v: str | None) -> str | None:
        if v is not None and len(v) > MAX_CONTENT_CHARS:
            raise ValueError("Document is too large")
        return v


class DocumentSummary(ORM):
    id: str
    title: str
    updated_at: UTCDateTime
    owner: UserOut
    # Caller's role on this document
    role: Access


class DocumentList(BaseModel):
    owned: list[DocumentSummary]
    shared: list[DocumentSummary]


class ShareOut(BaseModel):
    user: UserOut
    role: ShareRole


class DocumentOut(BaseModel):
    id: str
    title: str
    content: str
    created_at: UTCDateTime
    updated_at: UTCDateTime
    owner: UserOut
    role: Access
    can_edit: bool
    # Only populated for the owner
    shares: list[ShareOut] = []


class ShareCreate(BaseModel):
    email: Email
    role: ShareRole = ShareRole.editor
