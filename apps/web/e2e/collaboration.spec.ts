import { expect, test, type Browser, type Page } from "@playwright/test";

async function signInAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  return page;
}

const saved = (page: Page) => expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();

// Tests delete the documents they create, so they can also run repeatedly against a live
// deployment (E2E_BASE_URL) without leaving data behind.
const cleanup: Array<() => Promise<unknown>> = [];
const docIdFrom = (page: Page) => page.url().split("/documents/")[1];
function deleteAfterTest(page: Page) {
  const id = docIdFrom(page);
  cleanup.push(() => page.request.delete(`/api/documents/${id}`));
}
test.afterEach(async () => {
  for (const run of cleanup.splice(0)) await run().catch(() => {});
});

test("create, format, persist, share, and enforce permissions", async ({ browser }) => {
  const title = `Quarterly plan ${Date.now()}`;

  // ── Alice creates and formats a document ────────────────────────────────────────────────
  const alice = await signInAs(browser, "Alice Anderson");

  await alice.getByRole("button", { name: "+ New document" }).click();
  await expect(alice).toHaveURL(/\/documents\/.+/);
  deleteAfterTest(alice);

  const titleInput = alice.getByLabel("Document title");
  await titleInput.fill(title);
  await titleInput.press("Enter"); // commits the rename and moves focus into the body

  const body = alice.getByRole("textbox", { name: "Document content" });
  await alice.getByLabel("Text style").selectOption("h1");
  await alice.keyboard.type("Goals");
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("Ship the ");
  await alice.getByRole("button", { name: /^Bold/ }).click();
  await alice.keyboard.type("editor");
  await alice.getByRole("button", { name: /^Bold/ }).click();
  await alice.keyboard.press("Enter");
  await alice.getByRole("button", { name: "Bulleted list" }).click();
  await alice.keyboard.type("first");
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("second");

  await saved(alice);
  await expect(body.locator("h1")).toHaveText("Goals");
  await expect(body.locator("strong")).toHaveText("editor");
  await expect(body.locator("ul li")).toHaveCount(2);

  // ── Persistence: formatting survives a full reload ──────────────────────────────────────
  await alice.reload();
  await expect(alice.getByLabel("Document title")).toHaveValue(title);
  const reloaded = alice.getByRole("textbox", { name: "Document content" });
  await expect(reloaded.locator("h1")).toHaveText("Goals");
  await expect(reloaded.locator("strong")).toHaveText("editor");
  await expect(reloaded.locator("ul li")).toHaveText(["first", "second"]);

  // ── Share with Bob as a viewer ──────────────────────────────────────────────────────────
  await alice.getByRole("button", { name: "Share" }).click();
  const dialog = alice.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("bob@ajaia.test");
  await dialog.getByLabel("Permission", { exact: true }).selectOption("viewer");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog.getByText("Bob Brown")).toBeVisible();
  await alice.keyboard.press("Escape");

  // ── Bob sees it as shared, read-only ────────────────────────────────────────────────────
  const bob = await signInAs(browser, "Bob Brown");
  const sharedCard = bob.getByRole("region", { name: "Shared with me" }).getByRole("listitem").filter({ hasText: title });
  await expect(sharedCard).toContainText("Shared by Alice Anderson");
  await expect(sharedCard).toContainText("View only");
  await expect(bob.getByRole("region", { name: "My documents" })).not.toContainText(title);

  await sharedCard.getByRole("link").click();
  await expect(bob.getByText("You have view-only access")).toBeVisible();
  await expect(bob.getByRole("textbox", { name: "Document content" })).toHaveAttribute("contenteditable", "false");
  await expect(bob.getByLabel("Document title")).toHaveAttribute("readonly", "");
  await expect(bob.getByRole("button", { name: "Share" })).toHaveCount(0);
  await expect(bob.getByRole("toolbar")).toHaveCount(0);

  // ── A user with no access gets "not found", not the document ─────────────────────────────
  const docUrl = bob.url();
  const carol = await signInAs(browser, "Carol Chen");
  await carol.goto(docUrl);
  await expect(carol.getByRole("heading", { name: "Document not found" })).toBeVisible();

  // ── Upgrade Bob to editor; he can now edit and Alice sees the change ────────────────────
  await alice.getByRole("button", { name: "Share" }).click();
  await alice.getByRole("dialog").getByLabel("Permission for Bob Brown").selectOption("editor");
  await expect(alice.getByRole("dialog").getByLabel("Permission for Bob Brown")).toHaveValue("editor");
  await alice.keyboard.press("Escape");

  await bob.reload();
  await expect(bob.getByRole("toolbar")).toBeVisible();
  const bobBody = bob.getByRole("textbox", { name: "Document content" });
  await expect(bobBody).toHaveAttribute("contenteditable", "true");
  await bobBody.locator("ul li").last().click();
  await bob.keyboard.press("End");
  await bob.keyboard.type(" (edited by Bob)");
  await saved(bob);

  await alice.reload();
  await expect(alice.getByRole("textbox", { name: "Document content" }).locator("ul li").last()).toHaveText(
    "second (edited by Bob)",
  );
});

test("an editor's changes save, stay after navigating away, and show up for the owner without reload", async ({ browser }) => {
  const alice = await signInAs(browser, "Alice Anderson");
  await alice.getByRole("button", { name: "+ New document" }).click();
  await expect(alice).toHaveURL(/\/documents\/.+/);
  deleteAfterTest(alice);
  const docUrl = alice.url();
  const aliceBody = alice.getByRole("textbox", { name: "Document content" });
  await aliceBody.click();
  await alice.keyboard.type("Alice wrote this.");
  await saved(alice);

  // Share with Bob as editor (via the API; the dialog is covered by the test above)
  const res = await alice.request.post(`/api/documents/${docIdFrom(alice)}/shares`, {
    data: { email: "bob@ajaia.test", role: "editor" },
  });
  expect(res.ok()).toBeTruthy();

  // Bob edits and it saves
  const bob = await signInAs(browser, "Bob Brown");
  await bob.goto(docUrl);
  const bobBody = bob.getByRole("textbox", { name: "Document content" });
  await expect(bobBody).toContainText("Alice wrote this.");
  await expect(bobBody).toHaveAttribute("contenteditable", "true");
  await bobBody.click();
  await bob.keyboard.press("Control+End");
  await bob.keyboard.type(" Bob added this.");
  await saved(bob);

  // Alice sees Bob's change WITHOUT reloading
  await expect(aliceBody).toContainText("Alice wrote this. Bob added this.", { timeout: 15_000 });

  // Bob leaves and comes back: his edit is still there (no stale cached copy)
  await bob.getByRole("link", { name: "← Documents" }).click();
  await expect(bob.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await bob.goto(docUrl);
  await expect(bob.getByRole("textbox", { name: "Document content" }).locator("visible=true")).toContainText(
    "Alice wrote this. Bob added this.",
  );

  // Alice keeps typing (she picked up Bob's text, so nothing is overwritten) and Bob sees it
  await aliceBody.click();
  await alice.keyboard.press("Control+End");
  await alice.keyboard.type(" Alice again.");
  await saved(alice);
  await expect(bob.getByRole("textbox", { name: "Document content" }).locator("visible=true")).toContainText(
    "Alice wrote this. Bob added this. Alice again.",
    { timeout: 15_000 },
  );
});

test("import a markdown file as an editable document, and reject unsupported types", async ({ browser }) => {
  const carol = await signInAs(browser, "Carol Chen");
  const stamp = Date.now();
  const myDocsHeading = carol.getByRole("heading", { name: /^My documents/ });
  await expect(myDocsHeading).toBeVisible();
  const countBefore = await myDocsHeading.textContent();

  // Unsupported type: clear message, no document created
  await carol.getByLabel("Import file").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("not really an image"),
  });
  await expect(carol.getByRole("alert").filter({ hasText: "photo.png" })).toContainText(
    "Supported file types: .txt, .md, .docx",
  );
  await expect(myDocsHeading).toHaveText(countBefore!); // nothing was created

  // Markdown: becomes a new document with formatting preserved, titled from the file name
  const md = "# Launch checklist\n\nMake it **fast** and clear.\n\n- design\n- build\n";
  await carol.getByLabel("Import file").setInputFiles({
    name: `launch_checklist_${stamp}.md`,
    mimeType: "text/markdown",
    buffer: Buffer.from(md),
  });
  await expect(carol).toHaveURL(/\/documents\/.+/);
  deleteAfterTest(carol);
  await expect(carol.getByLabel("Document title")).toHaveValue(`launch checklist ${stamp}`);
  const body = carol.getByRole("textbox", { name: "Document content" });
  await expect(body.locator("h1")).toHaveText("Launch checklist");
  await expect(body.locator("strong")).toHaveText("fast");
  await expect(body.locator("ul li")).toHaveText(["design", "build"]);

  // It is a normal editable document: edit, autosave, persists
  await body.locator("ul li").last().click();
  await carol.keyboard.press("End");
  await carol.keyboard.type(" and ship");
  await saved(carol);
  await carol.reload();
  await expect(carol.getByRole("textbox", { name: "Document content" }).locator("ul li").last()).toHaveText(
    "build and ship",
  );

  // Back on the dashboard: the new doc is listed and the buttons aren't stuck in a busy state
  await carol.getByRole("link", { name: "← Documents" }).click();
  await expect(
    carol.getByRole("region", { name: "My documents" }).getByRole("listitem").filter({ hasText: `launch checklist ${stamp}` }),
  ).toBeVisible();
  await expect(carol.getByRole("button", { name: "+ New document" })).toBeEnabled();
  await expect(carol.getByRole("button", { name: "Choose file" })).toBeEnabled();

  // And creating another document still works right after
  await carol.getByRole("button", { name: "+ New document" }).click();
  // A different, new doc. (Cache Components keeps earlier pages mounted but hidden, so target the visible one.)
  await expect(carol.getByLabel("Document title").locator("visible=true")).toHaveValue("Untitled document");
  deleteAfterTest(carol);
});

test("signed-out users are sent to the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /Alice Anderson/ })).toBeVisible();
});
