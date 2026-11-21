import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page as BrowserPage,
} from "@playwright/test";
import type { Page } from "@lapuertahostels/payload-types";
import {
  customUrlLink,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";
import {
  cmsUrl,
  externalBehaviorSelect,
  openContent,
  openRichLinkDrawer,
  savePage,
  test,
} from "../common/cms-link-editor";

async function chooseExternalBehavior(
  scope: Locator,
  page: BrowserPage,
  label: string,
  value: string,
) {
  await externalBehaviorSelect(scope, label).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

test("external link controls retain defaults and persist overrides in structured and rich-text links", async ({
  page,
  request,
}) => {
  const source = await createExternalLinkPage();
  await openContent(page, source, false);
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Unrelated external title edit");
  await savePage(page, source);
  await openContent(page, source, false);
  await expectLegacyDefaults(request, source);
  const block = page.locator("#content-row-0");
  for (const label of ["Open in a new tab", "Suppress referrer"]) {
    await expect(externalBehaviorSelect(block, label)).toBeVisible();
  }
  await expect(block.getByLabel("Nofollow", { exact: true })).not.toBeChecked();

  await configureOverrides(page, source);
  await expectSavedSettings(request, source, "no", "yes", "no", true);

  await openContent(page, source, false);
  await expect(block.getByLabel("Nofollow", { exact: true })).toBeChecked();
  await chooseExternalBehavior(block, page, "Open in a new tab", "Default");
  await chooseExternalBehavior(block, page, "Suppress referrer", "Default");
  await block.getByLabel("Nofollow", { exact: true }).uncheck();
  await openRichLinkDrawer(page);
  const drawer = page.locator(".lexical-link-edit-drawer");
  await expect(drawer.getByLabel("Nofollow", { exact: true })).toBeChecked();
  await chooseExternalBehavior(drawer, page, "Open in a new tab", "Default");
  await chooseExternalBehavior(drawer, page, "Suppress referrer", "Default");
  await drawer.getByLabel("Nofollow", { exact: true }).uncheck();
  await drawer
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await savePage(page, source);
  await expectSavedSettings(
    request,
    source,
    "default",
    "default",
    "default",
    false,
  );
});

async function configureOverrides(page: BrowserPage, source: Page) {
  const block = page.locator("#content-row-0");
  await chooseExternalBehavior(block, page, "Open in a new tab", "No");
  await chooseExternalBehavior(block, page, "Suppress referrer", "No");
  await block.getByLabel("Nofollow", { exact: true }).check();
  await openRichLinkDrawer(page);
  const drawer = page.locator(".lexical-link-edit-drawer");
  await chooseExternalBehavior(drawer, page, "Open in a new tab", "Yes");
  await chooseExternalBehavior(drawer, page, "Suppress referrer", "No");
  await drawer.getByLabel("Nofollow", { exact: true }).check();
  await drawer
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await savePage(page, source);
}

async function expectLegacyDefaults(request: APIRequestContext, source: Page) {
  const legacySaved = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  const legacyContent = (await legacySaved.json()).content[0];
  for (const settings of [
    legacyContent.cta.link,
    legacyContent.text.root.children[0].children[0].fields,
  ]) {
    expect(settings.openInNewTab ?? "default").toBe("default");
    expect(settings.suppressReferrer ?? "default").toBe("default");
    expect(settings.noFollow ?? false).toBe(false);
  }
}

async function expectSavedSettings(
  request: APIRequestContext,
  source: Page,
  structuredTab: string,
  richTab: string,
  suppressReferrer: string,
  noFollow: boolean,
) {
  const saved = await request.get(
    cmsUrl(`/api/pages/${source.id}?depth=0&locale=en`),
  );
  expect(saved.ok()).toBeTruthy();
  const content = (await saved.json()).content[0];
  expect(content.cta.link).toMatchObject({
    openInNewTab: structuredTab,
    suppressReferrer,
    noFollow,
  });
  expect(content.text.root.children[0].children[0].fields).toMatchObject({
    openInNewTab: richTab,
    suppressReferrer,
    noFollow,
  });
}

function createExternalLinkPage() {
  // Seed missing settings directly, so an unrelated save exercises legacy content.
  return createPage({
    content: [
      {
        blockType: "LeadText",
        text: richTextRoot(
          paragraph(
            customUrlLink("https://example.com", text("Rich external")),
          ),
        ),
        cta: {
          show: true,
          label: "Structured external",
          link: { linkType: "custom", url: "https://example.com" },
        },
      },
    ],
  });
}
