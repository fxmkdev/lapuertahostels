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
    await selector.selectOption(brand);
    await expect(selector).toHaveValue(brand);
    await expect(preview.locator("#site-footer")).toHaveClass(
      new RegExp(brand === "puerta" ? "bg-puerta-100" : `bg-${brand}-50`),
    );
    await expect(
      preview.getByText(`Unsaved ${target} iframe`, { exact: true }),
    ).toBeVisible();
  }
  if (target === "footer")
    await expect(preview.locator("#site-footer")).toBeInViewport();
}

export async function verifyCommonScenarios(page: Page, preview: FrameLocator) {
  await preview.getByRole("combobox").selectOption("serverError");
  await preview.getByRole("combobox").selectOption("notFound");
  await expect(
    preview.getByText("Unsaved common iframe", { exact: true }),
  ).toBeVisible();
  await preview.getByRole("combobox").selectOption("labels");
  await expect(
    preview.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Log In", exact: true }),
  ).toBeVisible();
  await page
    .locator(".tabs-field__tab-button")
    .filter({ hasText: /^UI Labels$/ })
    .click();
  const dismiss = page.getByRole("textbox", { name: /^Dismiss/ });
  await dismiss.fill("Unsaved dismiss label");
  await expect(
    preview.getByRole("button", {
      name: "Unsaved dismiss label",
      exact: true,
    }),
  ).toBeVisible();
  await dismiss.fill("");
  await expect(
    preview.getByText("Unsaved dismiss label", { exact: true }),
  ).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Dismiss", exact: true }),
  ).toHaveCount(0);
  await page.locator(".tabs-field__tab-button").first().click();
  await preview.getByRole("combobox").selectOption("notFound");
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
  for (const width of [1440, 390]) {
    await popup.setViewportSize({ width, height: 900 });
    await expect(popup.getByRole("combobox")).toBeVisible();
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
