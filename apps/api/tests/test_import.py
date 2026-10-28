import io
import zipfile

from app.services.importer import title_from_filename


def upload(
    client, filename: str, data: bytes, content_type: str = "application/octet-stream"
):
    return client.post(
        "/documents/import", files={"file": (filename, data, content_type)}
    )


def make_docx(body_xml: str) -> bytes:
    """Build a minimal valid .docx in memory (no fixture files to keep in the repo)."""
    w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    parts = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>"
        ),
        "word/_rels/document.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            "</Relationships>"
        ),
        "word/styles.xml": (
            f'<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="{w}">'
            '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>'
            "</w:styles>"
        ),
        "word/document.xml": (
            f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{w}"><w:body>{body_xml}</w:body></w:document>'
        ),
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in parts.items():
            z.writestr(name, content)
    return buf.getvalue()


# ── .txt ──────────────────────────────────────────────────────────────────────────────────


def test_txt_becomes_paragraphs_and_line_breaks(alice):
    r = upload(alice, "meeting notes.txt", b"First para\nstill first\n\nSecond para\n")
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["title"] == "meeting notes"
    assert doc["content"] == "<p>First para<br>still first</p><p>Second para</p>"
    assert doc["role"] == "owner"


def test_txt_html_is_escaped_not_interpreted(alice):
    doc = upload(alice, "x.txt", b"<script>alert(1)</script> & <b>bold?</b>").json()
    assert "<script>" not in doc["content"]
    assert "<b>" not in doc["content"]
    assert "&lt;script&gt;" in doc["content"] and "&amp;" in doc["content"]


def test_txt_non_utf8_falls_back_to_windows_encoding(alice):
    doc = upload(alice, "cafe.txt", "café".encode("cp1252")).json()
    assert "café" in doc["content"]


# ── .md ───────────────────────────────────────────────────────────────────────────────────


def test_markdown_formatting_maps_to_editor_formatting(alice):
    md = b"# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n1. a\n2. b\n"
    doc = upload(alice, "readme.md", md, "text/markdown").json()
    c = doc["content"]
    assert "<h1>Title</h1>" in c
    assert "<strong>bold</strong>" in c and "<em>italic</em>" in c
    assert "<ul>" in c and c.count("<li>") == 4 and "<ol>" in c


def test_markdown_raw_html_is_neutralized(alice):
    md = b'Hello\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n'
    c = upload(alice, "evil.md", md).json()["content"]
    # Raw HTML must never become real elements; it is kept only as escaped, inert text.
    assert "<script" not in c and "<img" not in c
    assert "&lt;script&gt;" in c
    assert "Hello" in c


# ── .docx ─────────────────────────────────────────────────────────────────────────────────


def test_docx_formatting_survives(alice):
    body = (
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Report</w:t></w:r></w:p>'
        "<w:p>"
        '<w:r><w:t xml:space="preserve">Plain </w:t></w:r>'
        "<w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>"
        '<w:r><w:t xml:space="preserve"> </w:t></w:r>'
        '<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>under</w:t></w:r>'
        "</w:p>"
    )
    r = upload(alice, "Quarterly_Report.docx", make_docx(body))
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["title"] == "Quarterly Report"
    assert "<h1>Report</h1>" in doc["content"]
    assert "<strong>bold</strong>" in doc["content"]
    assert "<u>under</u>" in doc["content"]


def test_corrupt_docx_is_rejected_cleanly(alice):
    r = upload(alice, "broken.docx", b"PK\x03\x04 not really a zip")
    assert r.status_code == 400
    r = upload(alice, "fake.docx", b"just plain text pretending")
    assert r.status_code == 400
    assert "docx" in r.json()["error"]["message"]


# ── validation & access ───────────────────────────────────────────────────────────────────


def test_unsupported_type_is_415_and_names_supported_types(alice):
    r = upload(alice, "photo.png", b"\x89PNG\r\n")
    assert r.status_code == 415
    assert ".txt, .md, .docx" in r.json()["error"]["message"]
    assert upload(alice, "noextension", b"hello").status_code == 415


def test_empty_file_rejected(alice):
    assert upload(alice, "empty.txt", b"").status_code == 400
    assert upload(alice, "blank.md", b"   \n\n").status_code == 400


def test_oversized_file_rejected(alice):
    r = upload(alice, "big.txt", b"a" * (5 * 1024 * 1024 + 1))
    assert r.status_code == 413


def test_missing_file_is_validation_error(alice):
    r = alice.post("/documents/import")
    assert r.status_code == 422


def test_import_requires_login(make_client):
    assert upload(make_client(), "a.txt", b"hi").status_code == 401


def test_imported_doc_is_owned_listed_and_shareable(alice, bob):
    doc = upload(alice, "plan.md", b"# Plan\n").json()
    assert [d["title"] for d in alice.get("/documents").json()["owned"]] == ["plan"]
    assert bob.get(f"/documents/{doc['id']}").status_code == 404  # private until shared
    r = alice.post(f"/documents/{doc['id']}/shares", json={"email": "bob@ajaia.test"})
    assert r.status_code == 201
    assert bob.get(f"/documents/{doc['id']}").json()["content"] == "<h1>Plan</h1>"


def test_title_from_filename_strips_paths_and_extensions():
    assert title_from_filename("../../etc/evil.md") == "evil"
    assert title_from_filename("C:\\Users\\me\\My_Notes.TXT") == "My Notes"
    assert title_from_filename("") == "Imported document"
    assert title_from_filename(".md")  # dotfile: never an empty title
    assert len(title_from_filename("a" * 400 + ".txt")) == 255
