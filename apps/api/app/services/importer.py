"""Turn an uploaded file into editor-ready (sanitized) HTML.

Supported: .txt, .md/.markdown, .docx. Anything else is rejected with a clear message.
Conversion is deliberately conservative: only formatting the editor can represent survives
(headings, bold/italic/underline, lists, quotes). Images, tables and other rich content in
.docx files are dropped, and the UI says so.
"""

import html
import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath

import mammoth
from markdown_it import MarkdownIt

from app.services.sanitize import sanitize_html

SUPPORTED_EXTENSIONS = (".txt", ".md", ".markdown", ".docx")
SUPPORTED_LABEL = ".txt, .md, .docx"

# commonmark with raw HTML disabled: embedded <script>/<iframe> become inert text, not markup.
_markdown = MarkdownIt("commonmark", {"html": False}).enable("strikethrough")


class ImportRejected(Exception):
    """The file can't be imported. `status` is the HTTP status to report."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass
class ImportedDocument:
    title: str
    html: str


def _extension(filename: str) -> str:
    name = _basename(filename)
    dot = name.rfind(".")
    return name[dot:].lower() if dot > 0 else ""


def _basename(filename: str) -> str:
    # Browsers send a bare name, but never trust it: strip any path (either separator style).
    return PurePosixPath(PureWindowsPath(filename).name).name


def title_from_filename(filename: str) -> str:
    stem = _basename(filename)
    dot = stem.rfind(".")
    if dot > 0:
        stem = stem[:dot]
    stem = re.sub(r"[_\s]+", " ", stem).strip()
    return stem[:255] or "Imported document"


def _decode_text(data: bytes) -> str:
    for encoding in (
        "utf-8-sig",
        "cp1252",
    ):  # cp1252 covers most legacy Windows text files
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ImportRejected("That file doesn't look like readable text.")


def _txt_to_html(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    return "".join(
        "<p>"
        + "<br>".join(html.escape(line) for line in p.strip("\n").split("\n"))
        + "</p>"
        for p in paragraphs
    )


def _docx_to_html(data: bytes) -> str:
    if not data.startswith(b"PK") or not zipfile.is_zipfile(io.BytesIO(data)):
        raise ImportRejected("That doesn't look like a valid .docx file.")
    try:
        # "u => u" so Word underlines survive; mammoth ignores them by default.
        result = mammoth.convert_to_html(io.BytesIO(data), style_map="u => u")
    except Exception as exc:  # mammoth raises assorted errors for corrupt documents
        raise ImportRejected(
            "Couldn't read that .docx file. It may be corrupt."
        ) from exc
    return result.value


def import_file(filename: str, data: bytes) -> ImportedDocument:
    ext = _extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise ImportRejected(
            f"Unsupported file type{f' “{ext}”' if ext else ''}. Supported: {SUPPORTED_LABEL}.",
            status=415,
        )
    if not data.strip():
        raise ImportRejected("That file is empty.")

    if ext == ".txt":
        raw = _txt_to_html(_decode_text(data))
    elif ext in (".md", ".markdown"):
        # markdown-it separates blocks with newlines; drop them so stored HTML is tidy
        raw = re.sub(r">\s*\n\s*<", "><", _markdown.render(_decode_text(data))).strip()
    else:
        raw = _docx_to_html(data)

    return ImportedDocument(
        title=title_from_filename(filename), html=sanitize_html(raw)
    )
