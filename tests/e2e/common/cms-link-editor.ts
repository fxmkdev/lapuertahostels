import { createId } from "@paralleldrive/cuid2";
import {
  expect,
  test as base,
  type Locator,
  type Page as BrowserPage,
} from "@playwright/test";
import type { Page } from "@lapuertahostels/payload-types";
import { create } from "./cms";

export const test = base.extend<{ editorSession: void }>({
  editorSession: [
    async ({ page, request }, use) => {
      const email = `link-${createId()}@example.com`;
      const password = createId();
      const editor = await create("users", { email, password, role: "editor" });
      try {
        // Browser requests use the editor cookie; the API fixture retains its key.
        await page.context().setExtraHTTPHeaders({});
        const login = await page.request.post(cmsUrl("/api/users/login"), {
          data: { email, password },
        });
        expect(login.ok(), await login.text()).toBeTruthy();
        await use();
      } finally {
        await request.delete(cmsUrl(`/api/users/${editor.id}`));
      }
    },
    { auto: true },
  ],
});

export function cmsUrl(path: string) {
  return new URL(path, process.env.CMS_BASE_URL).toString();
}

export async function openContent(
  page: BrowserPage,
  source: Page,
  expectAnchor = true,
) {
  await page.goto(cmsUrl(`/admin/collections/pages/${source.id}`));
  await page
    .getByRole("main")
    .getByRole("button", { name: "Content", exact: true })
    .click();
  const block = page.locator("#content-row-0");
  await expect(block).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Show All", exact: true })
    .click();
  // Payload mounts off-screen field groups only after they enter the viewport.
  await block
    .getByRole("heading", { name: "Call to Action (CTA)", exact: true })
    .scrollIntoViewIfNeeded();
  if (expectAnchor) {
    await expect(page.getByLabel("Anchor", { exact: true })).toBeVisible();
    await expect(
      externalBehaviorSelect(block, "Open in a new tab"),
    ).toHaveCount(0);
    await expect(
      externalBehaviorSelect(block, "Suppress referrer"),
    ).toHaveCount(0);
    await expect(block.getByLabel("Nofollow", { exact: true })).toHaveCount(0);
  }
}

export async function savePage(page: BrowserPage, source: Page) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/api/pages/${source.id}`),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
}

export async function openRichLinkDrawer(page: BrowserPage) {
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.focus();
  await editor.press("Home");
  await editor.press("ArrowRight");
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
}

export function externalBehaviorSelect(scope: Locator, label: string) {
  return scope
    .locator(".field-type.select")
    .filter({ hasText: label })
    .getByRole("combobox");
}
