import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Opt-in: SCREENSHOTS=1 npx playwright test screenshots   → writes to <repo>/docs/screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate README screenshots");

const out = (name: string) => path.resolve(__dirname, "../../../docs/screenshots", `${name}.png`);

async function signInAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  return page;
}

test("capture screenshots", async ({ browser }) => {
  const login = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await login.goto("/login");
  await expect(login.getByRole("button", { name: /Alice/ })).toBeVisible();
  await login.screenshot({ path: out("1-login") });

  const alice = await signInAs(browser, "Alice Anderson");
  await alice.getByRole("button", { name: "+ New document" }).click();
  await alice.getByLabel("Document title").fill("Q4 product brief");
  await alice.getByLabel("Document title").press("Enter");
  await alice.getByLabel("Text style").selectOption("h1");
  await alice.keyboard.type("Goals for Q4");
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("We want to make shared work ");
  await alice.getByRole("button", { name: /^Bold/ }).click();
  await alice.keyboard.type("faster");
  await alice.getByRole("button", { name: /^Bold/ }).click();
  await alice.keyboard.type(" and easier to follow.");
  await alice.keyboard.press("Enter");
  await alice.getByRole("button", { name: "Bulleted list" }).click();
  await alice.keyboard.type("Ship the editor");
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("Add sharing");
  await expect(alice.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  await alice.screenshot({ path: out("3-editor") });

  await alice.getByRole("button", { name: "Share" }).click();
  const dialog = alice.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("bob@ajaia.test");
  await dialog.getByLabel("Permission", { exact: true }).selectOption("viewer");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(dialog.getByText("Bob Brown")).toBeVisible();
  await alice.screenshot({ path: out("4-share-dialog") });
  await alice.keyboard.press("Escape");

  await alice.getByRole("link", { name: "← Documents" }).click();
  await expect(alice.getByText("Q4 product brief")).toBeVisible();
  await alice.screenshot({ path: out("2-dashboard-owner") });

  const bob = await signInAs(browser, "Bob Brown");
  await expect(bob.getByText("Shared by Alice Anderson")).toBeVisible();
  await bob.screenshot({ path: out("5-dashboard-shared") });
  await bob.getByRole("link", { name: /Q4 product brief/ }).click();
  await expect(bob.getByText("You have view-only access")).toBeVisible();
  await bob.screenshot({ path: out("6-viewer") });
});
