"""HTML sanitization. Document content is stored as HTML, so every write goes through here."""

import nh3

# Only what the editor toolbar can produce (plus line breaks / quotes).
ALLOWED_TAGS = {
    "p", "br", "h1", "h2", "h3",
    "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "blockquote",
}  # fmt: skip


def sanitize_html(html: str) -> str:
    return nh3.clean(html, tags=ALLOWED_TAGS, attributes={})
