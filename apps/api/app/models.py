import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class ShareRole(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), default="Untitled document")
    # Sanitized HTML produced by the editor (see services/sanitize.py)
    content: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    owner: Mapped[User] = relationship()
    shares: Mapped[list["DocumentShare"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentShare(Base):
    __tablename__ = "document_shares"
    __table_args__ = (UniqueConstraint("document_id", "user_id", name="uq_share_doc_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[ShareRole] = mapped_column(Enum(ShareRole), default=ShareRole.editor)

    document: Mapped[Document] = relationship(back_populates="shares")
    user: Mapped[User] = relationship()
