import { expect, test } from "@playwright/test";
import type { FrameLocator, Locator, Page } from "@playwright/test";

export function getPreviewOrigin(
  frontendBaseUrl = process.env.FRONTEND_BASE_URL!,
) {
  const url = new URL(frontendBaseUrl);
  // Match LIVE_PREVIEW_URL in the disposable Compose services, keeping its port.
  url.hostname = "127.0.0.1";
  return url.origin;
}

export async function verifyBrandContexts(
  preview: FrameLocator,
  target: "banner" | "footer",
) {
  const selector = preview.getByRole("combobox", {
    name: /Preview brand/,
  });
  await expect(selector).toHaveValue("puerta");
  for (const brand of ["aqua", "azul", "puerta"]) {
    if (target === "footer")
      await preview.getByRole("main").evaluate((element) => {
        element.style.minHeight = "200vh";
      });
    await selector.selectOption(brand);
    await expect(selector).toHaveValue(brand);
    await expect(preview.locator("#site-footer")).toHaveClass(
      new RegExp(brand === "puerta" ? "bg-puerta-100" : `bg-${brand}-50`),
    );
    await expect(
      preview.getByText(`Unsaved ${target} iframe`, { exact: true }),
    ).toBeVisible();
    if (target === "footer") {
      await expect
        .poll(() =>
          preview
            .locator("[data-preview-content]")
            .evaluate((element) => element.scrollTop),
        )
        .toBeGreaterThan(0);
      await verifyFooterFrame(preview);
    }
  }
}

export async function verifyCommonScenarios(page: Page, preview: FrameLocator) {
  const selector = preview.getByRole("combobox");
  const tabs = page.locator(".tabs-field__tab-button");
  const errorTab = tabs.filter({ hasText: /^Internal Server Error Screen$/ });
  await expect(selector.locator("option")).toHaveCount(2);
  await selector.selectOption("serverError");
  await expect(tabs.first()).toHaveClass(/--active/);
  await errorTab.click();
  await expect(selector).toHaveValue("serverError");
  await page
    .getByRole("textbox", { name: /^Heading/ })
    .first()
    .fill("Unsaved server error iframe");
  await expect(
    preview.getByRole("heading", {
      name: "Unsaved server error iframe",
      exact: true,
    }),
  ).toBeVisible();
  await selector.selectOption("notFound");
  await expect(errorTab).toHaveClass(/--active/);
  await tabs.filter({ hasText: /^UI Labels$/ }).click();
  await expect(selector).toHaveValue("notFound");
  await errorTab.click();
  await expect(selector).toHaveValue("serverError");
  await tabs.first().click();
  await expect(selector).toHaveValue("notFound");
  await expect(
    preview.getByText("Unsaved common iframe", { exact: true }),
  ).toBeVisible();
}

export async function restoreCommonTab(page: Page) {
  const tab = page
    .locator(".tabs-field__tab-button")
    .filter({ hasText: /^Internal Server Error Screen$/ });
  const stored = page.waitForResponse(
    (response) =>
      response.url().includes("/payload-preferences/") &&
      response.request().method() === "POST" &&
      /"tabIndex"\s*:\s*1/.test(response.request().postData() ?? ""),
  );
  await tab.click();
  await stored;
  await page.reload();
  await expect(tab).toHaveClass(/--active/);
}

async function verifyFooterFrame(preview: FrameLocator | Page) {
  const toolbar = preview.locator("[data-preview-toolbar]");
  const content = preview.locator("[data-preview-content]");
  await expect(toolbar).toBeInViewport();
  const bar = await toolbar.boundingBox();
  const pane = await content.boundingBox();
  expect(bar).not.toBeNull();
  expect(pane).not.toBeNull();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(pane!.y + 1);
  await expect(preview.locator("#site-footer")).toBeInViewport();
}

export async function verifyPreviewPopup(
  page: Page,
  field: Locator,
  target: "banner" | "footer" | "common",
) {
  const popupPromise = page.waitForEvent("popup");
  await page.getByTitle(/^Open in new window$/i).click();
  const popup = await popupPromise;
  await expect(
    popup.getByText(`Unsaved ${target} iframe`, { exact: true }),
  ).toBeVisible();
  await field.fill(`Unsaved ${target} popup`);
  await expect(
    popup.getByText(`Unsaved ${target} popup`, { exact: true }),
  ).toBeVisible();
  await expect(popup.getByRole("alert")).toHaveCount(0);
  if (target === "common") {
    const errorTab = page
      .locator(".tabs-field__tab-button")
      .filter({ hasText: /^Internal Server Error Screen$/ });
    await errorTab.click();
    await expect(popup.getByRole("combobox")).toHaveValue("serverError");
    await expect(
      popup.getByRole("heading", {
        name: "Unsaved server error iframe",
        exact: true,
      }),
    ).toBeVisible();
    await page.locator(".tabs-field__tab-button").first().click();
    await expect(popup.getByRole("combobox")).toHaveValue("notFound");
    await expect(
      popup.getByText("Unsaved common popup", { exact: true }),
    ).toBeVisible();
  }
  for (const width of [1440, 390]) {
    await popup.setViewportSize({ width, height: 900 });
    await expect(popup.getByRole("combobox")).toBeVisible();
    if (target === "footer") await verifyFooterFrame(popup);
    expect(
      await popup.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await popup.screenshot({
      path: test.info().outputPath(`${target}-${width}.png`),
    });
  }
  const control = popup.getByRole("combobox");
  await control.focus();
  await expect(control).toBeFocused();
}
