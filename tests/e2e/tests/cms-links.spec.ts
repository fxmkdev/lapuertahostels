import { createId } from "@paralleldrive/cuid2";
import {
  expect,
  test,
  type Locator,
  type Page as BrowserPage,
} from "@playwright/test";
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

async function createLinkedPage(fragment = "legacy-fragment") {
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
      fragment,
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
            fragment,
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
  await expect(page.locator("form.collection-edit__form")).toHaveAttribute(
    "data-form-ready",
    "true",
  );
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
  const cta = block.locator("#field-content__0__cta");
  await expect(cta).toBeVisible();
  // Payload observes the field bodies, separately from their headings. Recenter
  // the deepest body as nested groups mount and change the block's layout.
  const anchor = cta.getByLabel("Anchor", { exact: true });
  await expect
    .poll(async () => {
      await cta
        .locator(".render-fields")
        .last()
        .evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" }),
        );
      return anchor.isVisible();
    })
    .toBe(true);
  await expect(anchor).toBeVisible();
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

async function expectAlignedLinkFields(
  scope: Locator,
  stacked: boolean,
  screenshotName: string,
) {
  const query = scope.getByLabel("Query string", { exact: true });
  const anchor = scope.getByLabel("Anchor", { exact: true });
  const control = anchor.locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rs__control ")][1]',
  );
  await query.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const [queryBox, anchorBox] = await Promise.all([
        query.boundingBox(),
        control.boundingBox(),
      ]);
      if (!queryBox || !anchorBox) return Infinity;
      return Math.max(
        Math.abs(queryBox.width - anchorBox.width),
        Math.abs(queryBox.height - anchorBox.height),
        stacked
          ? Math.abs(queryBox.x - anchorBox.x)
          : Math.abs(queryBox.y - anchorBox.y),
      );
    })
    .toBeLessThanOrEqual(2);
  if (stacked) {
    const queryBox = await query.boundingBox();
    const anchorBox = await control.boundingBox();
    expect(anchorBox!.y).toBeGreaterThanOrEqual(queryBox!.y + queryBox!.height);
  }
  expect(
    await control.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  const row = anchor.locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " row ")][1]',
  );
  await test.info().attach(screenshotName, {
    body: await row.screenshot(),
    contentType: "image/png",
  });
}

async function expectLinkHelp(scope: Locator, page: BrowserPage) {
  for (const name of ["About query strings", "About anchors"]) {
    const button = scope.getByRole("button", { name, exact: true });
    await button.focus();
    await expect(scope.getByRole("tooltip")).toBeVisible();
    await button.press("Escape");
    await expect(scope.getByRole("tooltip")).toHaveCount(0);
    await expect(button).toBeFocused();
    await button.click();
    const tooltip = scope.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await button.click();
    await expect(tooltip).toHaveCount(0);
  }
}

async function expectHoverHelp(scope: Locator, page: BrowserPage) {
  for (const name of ["About query strings", "About anchors"]) {
    // Remove focus/click state so this exercises hover alone.
    await scope.getByLabel("Query string", { exact: true }).focus();
    await page.mouse.move(0, 0);
    const button = scope.getByRole("button", { name, exact: true });
    await button.hover();
    const tooltip = scope.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const triggerBox = await button.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();
    const x = triggerBox!.x + triggerBox!.width / 2;
    const gapY = (triggerBox!.y + triggerBox!.height + tooltipBox!.y) / 2;
    await page.mouse.move(x, gapY, { steps: 8 });
    await expect(tooltip).toBeVisible();
    await page.mouse.move(tooltipBox!.x + 16, tooltipBox!.y + 16, { steps: 8 });
    await expect(tooltip).toBeVisible();
    await page.mouse.move(
      tooltipBox!.x + tooltipBox!.width / 2,
      tooltipBox!.y + tooltipBox!.height / 2,
      { steps: 8 },
    );
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const mobile of [false, true]) {
    test(`internal-link layout and help: ${theme}, ${mobile ? "mobile" : "desktop"}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const longAnchor = `experiences-${"nearby-".repeat(12)}and-adventures`;
      const source = await createLinkedPage(longAnchor);
      await openContent(page, source);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const block = page.locator("#content-row-0");
      await expectAlignedLinkFields(block, mobile, "structured-link-fields");
      await expect(
        block.getByText(`#${longAnchor}`, { exact: true }),
      ).toBeVisible();
      if (!mobile) await expectHoverHelp(block, page);
      await expectLinkHelp(block, page);
      await openRichLinkDrawer(page);
      const drawer = page.locator(".lexical-link-edit-drawer");
      await expectAlignedLinkFields(drawer, mobile, "rich-text-link-fields");
      if (!mobile) await expectHoverHelp(drawer, page);
      await expectLinkHelp(drawer, page);
      await expect(
        drawer.getByRole("heading", { name: "Edit Link", exact: true }),
      ).toBeVisible();
    });
  }
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

  const fragment = page.getByLabel("Anchor", { exact: true });
  await fragment.click();
  await page.getByRole("option", { name: "#rooms", exact: true }).click();
  await savePage(page, source);
  await openContent(page, source);
  await expect(page.getByText("#rooms", { exact: true })).toBeVisible();

  await page.getByLabel("Anchor", { exact: true }).fill("custom-anchor");
  await expect(
    page.getByRole("option", { name: "Use custom-anchor", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Anchor", { exact: true }).press("Enter");
  await savePage(page, source);
  const saved = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  expect((await saved.json()).content[0].cta.link).toMatchObject({
    fragment: "custom-anchor",
    queryString: "source=cta",
  });

  await openContent(page, source);
  await page.getByLabel("Anchor", { exact: true }).focus();
  await page.getByLabel("Anchor", { exact: true }).press("Backspace");
  await page.getByLabel("Anchor", { exact: true }).press("Escape");
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
  await drawer.getByLabel("Anchor", { exact: true }).click();
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
