import { createId } from "@paralleldrive/cuid2";
import { expect, test, type Page as BrowserPage } from "@playwright/test";
import type { Page } from "@lapuertahostels/payload-types";
import {
  internalLink,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

import { create, createPage } from "../common/cms";

function cmsUrl(path: string) {
  return new URL(path, process.env.CMS_BASE_URL).toString();
}

let editorId: string;

test.beforeEach(async ({ page }) => {
  const email = `anchor-${createId()}@example.com`;
  const password = createId();
  const editor = await create("users", { email, password, role: "editor" });
  editorId = editor.id;
  // Use the editor's cookie in the browser, rather than the suite's API key.
  await page.context().setExtraHTTPHeaders({});
  const login = await page.request.post(cmsUrl("/api/users/login"), {
    data: { email, password },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
});

test.afterEach(async ({ request }) => {
  if (editorId) await request.delete(cmsUrl(`/api/users/${editorId}`));
});

async function createLinkedPage() {
  const target = await createPage({
    content: [
      {
        blockType: "LeadText",
        elementId: "rooms",
        text: richTextRoot(paragraph(text("Rooms"))),
      },
      {
        blockType: "LeadText",
        elementId: "contact",
        text: richTextRoot(paragraph(text("Contact"))),
      },
    ],
  });
  const richLink = {
    ...internalLink(target.pathname, text("Rich anchor link")),
    fields: {
      linkType: "internal",
      doc: { relationTo: "pages", value: target.id },
      fragment: "legacy-fragment",
      queryString: "source=rich",
    },
  };
  const source = (await create("pages", {
    pathname: `/e2e/${createId()}`,
    title: "Anchor link editor test",
    brand: "puerta",
    content: [
      {
        blockType: "LeadText",
        text: {
          root: {
            ...richTextRoot().root,
            children: [{ ...paragraph(), children: [richLink] }],
          },
        },
        cta: {
          show: true,
          label: "Structured anchor link",
          link: {
            linkType: "internal",
            doc: target.id,
            fragment: "legacy-fragment",
            queryString: "source=cta",
          },
        },
      },
    ],
  })) as Page;
  return source;
}

async function openContent(page: BrowserPage, source: Page) {
  await page.goto(cmsUrl(`/admin/collections/pages/${source.id}`));
  await page
    .getByRole("main")
    .getByRole("button", { name: "Content", exact: true })
    .click();
  const block = page.locator("#content-row-0");
  await expect(block).toBeVisible();
  const toggle = block.locator(".collapsible__toggle--collapsed").first();
  if (await toggle.count()) await toggle.click();
  // Payload mounts off-screen field groups only after they enter the viewport.
  await block
    .getByRole("heading", { name: "Call to Action (CTA)", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Fragment", { exact: true })).toBeVisible();
}

async function savePage(page: BrowserPage, source: Page) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/api/pages/${source.id}`),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
}

async function openRichLinkDrawer(page: BrowserPage) {
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.focus();
  await editor.press("Home");
  await editor.press("ArrowRight");
  await page.getByRole("button", { name: "Edit link", exact: true }).click();
}

test("structured links preserve legacy fragments and save selected or custom anchors", async ({
  page,
  request,
}) => {
  const source = await createLinkedPage();
  await openContent(page, source);
  await expect(
    page.getByText("#legacy-fragment", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Unrelated title edit");
  await savePage(page, source);
  await openContent(page, source);
  await expect(
    page.getByText("#legacy-fragment", { exact: true }),
  ).toBeVisible();

  const fragment = page.getByLabel("Fragment", { exact: true });
  await fragment.click();
  await page.getByRole("option", { name: "#rooms", exact: true }).click();
  await savePage(page, source);
  await openContent(page, source);
  await expect(page.getByText("#rooms", { exact: true })).toBeVisible();

  await page.getByLabel("Fragment", { exact: true }).fill("custom-anchor");
  await expect(
    page.getByRole("option", { name: "Use custom-anchor", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fragment", { exact: true }).press("Enter");
  await savePage(page, source);
  const saved = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  expect((await saved.json()).content[0].cta.link).toMatchObject({
    fragment: "custom-anchor",
    queryString: "source=cta",
  });

  await openContent(page, source);
  await page.getByLabel("Fragment", { exact: true }).focus();
  await page.getByLabel("Fragment", { exact: true }).press("Backspace");
  await page.getByLabel("Fragment", { exact: true }).press("Escape");
  await savePage(page, source);
  await openContent(page, source);
  await expect(page.getByText("#custom-anchor", { exact: true })).toHaveCount(
    0,
  );
  const cleared = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  expect((await cleared.json()).content[0].cta.link.fragment).toBeFalsy();
});

test("rich-text link drawers select anchors and retain them after saving and reopening", async ({
  page,
  request,
}) => {
  const source = await createLinkedPage();
  await openContent(page, source);
  await openRichLinkDrawer(page);
  const drawer = page.locator(".lexical-link-edit-drawer");
  await expect(
    drawer.getByText("#legacy-fragment", { exact: true }),
  ).toBeVisible();
  await drawer.getByLabel("Fragment", { exact: true }).click();
  await page.getByRole("option", { name: "#contact", exact: true }).click();
  await drawer
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await savePage(page, source);

  const saved = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  expect(
    (await saved.json()).content[0].text.root.children[0].children[0].fields,
  ).toMatchObject({ fragment: "contact", queryString: "source=rich" });
  await openContent(page, source);
  await openRichLinkDrawer(page);
  await expect(
    page
      .locator(".lexical-link-edit-drawer")
      .getByText("#contact", { exact: true }),
  ).toBeVisible();
});
