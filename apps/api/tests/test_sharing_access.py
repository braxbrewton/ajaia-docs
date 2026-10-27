"""Access matrix: owner / editor / viewer / stranger."""

from tests.conftest import BOB, CAROL


def share(alice, doc_id, email, role="editor"):
    return alice.post(
        f"/documents/{doc_id}/shares", json={"email": email, "role": role}
    )


def test_stranger_cannot_see_document_404(alice, bob):
    doc = alice.post("/documents", json={}).json()
    assert bob.get(f"/documents/{doc['id']}").status_code == 404
    assert bob.patch(f"/documents/{doc['id']}", json={"title": "x"}).status_code == 404
    assert bob.delete(f"/documents/{doc['id']}").status_code == 404
    assert bob.get(f"/documents/{doc['id']}/shares").status_code == 404


def test_share_makes_doc_visible_in_shared_list(alice, bob):
    doc = alice.post("/documents", json={"title": "Spec"}).json()
    assert share(alice, doc["id"], BOB).status_code == 201

    listing = bob.get("/documents").json()
    assert listing["owned"] == []
    assert [d["title"] for d in listing["shared"]] == ["Spec"]
    assert listing["shared"][0]["owner"]["email"] == "alice@ajaia.test"
    assert listing["shared"][0]["role"] == "editor"


def test_editor_can_edit_but_not_manage(alice, bob, carol):
    doc = alice.post("/documents", json={"content": "<p>v1</p>"}).json()
    share(alice, doc["id"], BOB, "editor")

    got = bob.get(f"/documents/{doc['id']}").json()
    assert got["role"] == "editor" and got["can_edit"] is True
    assert got["shares"] == []  # sharing list is owner-only

    assert (
        bob.patch(f"/documents/{doc['id']}", json={"content": "<p>v2</p>"}).status_code
        == 200
    )
    assert alice.get(f"/documents/{doc['id']}").json()["content"] == "<p>v2</p>"

    assert bob.delete(f"/documents/{doc['id']}").status_code == 403
    assert share(bob, doc["id"], CAROL).status_code == 403


def test_viewer_is_read_only(alice, bob):
    doc = alice.post("/documents", json={"content": "<p>v1</p>"}).json()
    share(alice, doc["id"], BOB, "viewer")

    got = bob.get(f"/documents/{doc['id']}").json()
    assert got["role"] == "viewer" and got["can_edit"] is False

    r = bob.patch(f"/documents/{doc['id']}", json={"content": "<p>hax</p>"})
    assert r.status_code == 403
    assert alice.get(f"/documents/{doc['id']}").json()["content"] == "<p>v1</p>"


def test_owner_sees_share_list(alice):
    doc = alice.post("/documents", json={}).json()
    share(alice, doc["id"], BOB, "viewer")
    shares = alice.get(f"/documents/{doc['id']}").json()["shares"]
    assert [(s["user"]["email"], s["role"]) for s in shares] == [(BOB, "viewer")]


def test_resharing_updates_role(alice, bob):
    doc = alice.post("/documents", json={}).json()
    share(alice, doc["id"], BOB, "viewer")
    assert share(alice, doc["id"], BOB, "editor").status_code == 201
    assert len(alice.get(f"/documents/{doc['id']}/shares").json()) == 1
    assert bob.get(f"/documents/{doc['id']}").json()["role"] == "editor"


def test_revoke_removes_access(alice, bob):
    doc = alice.post("/documents", json={}).json()
    bob_id = share(alice, doc["id"], BOB).json()["user"]["id"]
    assert alice.delete(f"/documents/{doc['id']}/shares/{bob_id}").status_code == 204
    assert bob.get(f"/documents/{doc['id']}").status_code == 404
    assert bob.get("/documents").json()["shared"] == []
    # revoking again is a clean 404
    assert alice.delete(f"/documents/{doc['id']}/shares/{bob_id}").status_code == 404


def test_share_validation(alice):
    doc = alice.post("/documents", json={}).json()
    assert share(alice, doc["id"], "ghost@ajaia.test").status_code == 404
    assert share(alice, doc["id"], "alice@ajaia.test").status_code == 400
    assert share(alice, doc["id"], BOB, "admin").status_code == 422


def test_deleting_document_removes_shares(alice, bob):
    doc = alice.post("/documents", json={}).json()
    share(alice, doc["id"], BOB)
    alice.delete(f"/documents/{doc['id']}")
    assert bob.get("/documents").json()["shared"] == []
