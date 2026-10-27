def create(client, **body):
    r = client.post("/documents", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_rename_edit_reopen(alice):
    doc = create(alice, title="Plan")
    assert doc["role"] == "owner" and doc["can_edit"] is True

    r = alice.patch(
        f"/documents/{doc['id']}",
        json={
            "title": "Roadmap",
            "content": "<h1>Hi</h1><p><strong>bold</strong> <u>u</u></p>",
        },
    )
    assert r.status_code == 200

    reopened = alice.get(f"/documents/{doc['id']}").json()
    assert reopened["title"] == "Roadmap"
    # formatting survives the round trip
    assert reopened["content"] == "<h1>Hi</h1><p><strong>bold</strong> <u>u</u></p>"


def test_default_title_and_blank_title_rejected(alice):
    assert create(alice)["title"] == "Untitled document"
    doc = create(alice)
    r = alice.patch(f"/documents/{doc['id']}", json={"title": "   "})
    assert r.status_code == 422


def test_partial_update_keeps_other_fields(alice):
    doc = create(alice, title="Keep me", content="<p>body</p>")
    alice.patch(f"/documents/{doc['id']}", json={"title": "New"})
    got = alice.get(f"/documents/{doc['id']}").json()
    assert got["title"] == "New" and got["content"] == "<p>body</p>"


def test_content_is_sanitized(alice):
    doc = create(alice)
    evil = (
        '<p onclick="x()">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>'
    )
    alice.patch(f"/documents/{doc['id']}", json={"content": evil})
    content = alice.get(f"/documents/{doc['id']}").json()["content"]
    assert (
        "script" not in content and "onclick" not in content and "<img" not in content
    )
    assert "ok" in content


def test_list_splits_owned_and_empty_shared(alice):
    create(alice, title="A")
    create(alice, title="B")
    r = alice.get("/documents").json()
    assert sorted(d["title"] for d in r["owned"]) == ["A", "B"]
    assert r["shared"] == []


def test_delete_document(alice):
    doc = create(alice)
    assert alice.delete(f"/documents/{doc['id']}").status_code == 204
    assert alice.get(f"/documents/{doc['id']}").status_code == 404


def test_unknown_document_is_404(alice):
    assert alice.get("/documents/does-not-exist").status_code == 404


def test_timestamps_are_timezone_aware(alice):
    doc = create(alice)
    # Must carry an explicit UTC offset so browsers don't read it as local time
    assert doc["updated_at"].endswith(("Z", "+00:00"))
    assert (
        alice.get("/documents")
        .json()["owned"][0]["updated_at"]
        .endswith(("Z", "+00:00"))
    )
