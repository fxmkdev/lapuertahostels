import { expect, test } from "@playwright/test";
import {
  story,
  capture,
  noOverflow,
  targets,
  waitForGallery,
  swipeLeft,
} from "./helpers";

const widths = [320, 375, 640, 767];

test.beforeEach(async ({ page }) => {
  // Deterministic images/fonts keep these geometry checks independent of services.
  await page.route("https://images.example.com/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="420"><rect width="560" height="420" fill="#d1d5db"/></svg>',
    }),
  );
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: "" }),
  );
});

for (const width of widths) {
  test(`shared button variants and form validation at ${width}px`, async ({
    page,
  }, info) => {
    await story(page, "common-button--all-variants", width);
    await targets(page.locator("button, a"), info, "buttons");
    await noOverflow(page);
    await page.getByRole("link", { name: "Go", exact: true }).tap();
    await expect(page).toHaveURL(/#destination$/);

    await story(page, "common-button--long-labels", width);
    await targets(page.getByRole("button"), info, "long-labels");
    await noOverflow(page);
    await capture(page, info, "long-labels.png", true);

    await story(page, "common-button--form-controls", width);
    await targets(page.locator("input, button"), info, "form-controls");
    await page.getByRole("button", { name: "Sign in" }).tap();
    await expect(page.locator("output")).toHaveText("Not submitted");
    await page.getByLabel("Email", { exact: true }).fill("invalid");
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).tap();
    await expect(page.locator("output")).toHaveText("Not submitted");
    await page.getByLabel("Email", { exact: true }).fill("guest@example.com");
    await page.getByRole("button", { name: "Sign in" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("output")).toHaveText("Submitted");
    await noOverflow(page);
  });

  test(`navigation and locale targets at ${width}px`, async ({
    page,
  }, info) => {
    await story(page, "layout-navbar--default", width);
    await targets(page.locator("a, button"), info, "navbar");
    const booking = page.getByRole("link", { name: "Book Now" });
    await expect(booking).toBeVisible();
    expect(
      await booking.evaluate((element) => getComputedStyle(element).position),
    ).toBe(width < 640 ? "fixed" : "static");
    await page.getByRole("button", { name: "Open main menu" }).tap();
    await targets(page.locator("a, button"), info, "open-menu");
    await noOverflow(page);
    await capture(page, info, "navbar-menu.png");

    if (width < 640) {
      await page.getByRole("menuitem", { name: "English" }).tap();
      await expect(
        page.getByRole("dialog").getByRole("button", { name: "Español" }),
      ).toBeVisible();
      await targets(
        page.getByRole("dialog").getByRole("button"),
        info,
        "locale-dialog",
      );
    } else {
      await page.getByRole("button", { name: "Open main menu" }).tap();
      await page.getByRole("button", { name: "English" }).tap();
      await targets(page.getByRole("menuitem"), info, "locale-dropdown");
    }
    const localeRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/locale") && request.method() === "POST",
    );
    await page.route("**/locale", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<p>Locale selected</p>",
      }),
    );
    await page
      .getByRole(width < 640 ? "button" : "menuitem", { name: "Español" })
      .tap();
    expect((await localeRequest).postData()).toContain("locale=es");
    await expect(
      page.getByText("Locale selected", { exact: true }),
    ).toBeVisible();
    await story(page, "layout-navbar--long-spanish-label", width);
    await targets(page.locator("a, button"), info, "long-booking-label");
    const rect = await page
      .getByRole("link", { name: "Reserva ahora" })
      .boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(width < 640 ? 24 : 16);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(
      width - (width < 640 ? 24 : 16),
    );
    await noOverflow(page);
  });

  test(`banner, footer, preview bar and CTAs at ${width}px`, async ({
    page,
  }, info) => {
    await story(page, "layout-banner--long-spanish-label", width);
    await targets(page.locator("a, button"), info, "banner");
    await noOverflow(page);
    await capture(page, info, "banner.png");
    await page.getByRole("button").tap();
    await expect(page.getByRole("button")).toBeHidden();

    await story(page, "layout-footer--long-spanish-label", width);
    await targets(
      page.locator("footer a, footer button, footer input"),
      info,
      "footer",
    );
    await noOverflow(page);
    await capture(page, info, "footer.png", true);

    for (const id of [
      "layout-preview-bar--spanish",
      "blocks-common-overlaytitle--default",
      "blocks-lead-text-block--with-call-to-action",
      "blocks-room-list-block-room-card--default",
    ]) {
      await story(page, id, width);
      await targets(page.locator("a, button"), info, id);
      await noOverflow(page);
    }
  });

  test(`gallery controls at ${width}px`, async ({ page }, info) => {
    await story(page, "common-image-viewer--default", width);
    await targets(page.getByRole("button"), info, "gallery-thumbnails");
    await page.getByRole("button").first().tap();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeVisible();
    await targets(dialog.getByRole("button"), info, "gallery-controls");
    await dialog.getByRole("button", { name: "Next", exact: true }).tap();
    await expect(dialog.getByText("2 / 7")).toBeVisible();
    await dialog.getByRole("button", { name: "Previous", exact: true }).tap();
    await expect(dialog.getByText("1 / 7")).toBeVisible();
    await waitForGallery(page, dialog);
    await capture(page, info, "gallery.png");
    const fullscreen = dialog.getByRole("button", {
      name: "Full Screen",
      exact: true,
    });
    if (await fullscreen.count()) {
      await fullscreen.tap();
      await expect
        .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
        .toBe(true);
      await dialog
        .getByRole("button", { name: "Exit Full Screen", exact: true })
        .tap();
      await expect
        .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
        .toBe(false);
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(dialog).toBeHidden();
  });

  test(`dense slide selectors at ${width}px`, async ({ page }, info) => {
    await story(page, "blocks-hero-slides-block--many-slides", width);
    const selectors = page.getByRole("button").filter({ visible: true });
    await targets(page.locator("a, button"), info, "slides-and-cta");
    await noOverflow(page);
    if (width < 480) {
      const strip = selectors.first().locator("..");
      const box = (await strip.boundingBox())!;
      await swipeLeft(page, { x: width - 32, y: box.y + box.height / 2 }, 120);
      await expect
        .poll(() => strip.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      await expect(
        page.getByRole("heading", { name: "Lost City", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Parque Tayrona", exact: true }),
      ).toBeHidden();
    }
    await selectors.last().scrollIntoViewIfNeeded();
    await selectors.last().tap();
    await expect(
      page.getByRole("heading", { name: "Parque Tayrona", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lost City", exact: true }),
    ).toBeHidden();
    await noOverflow(page);
    await capture(page, info, "slides.png");
    await targets(page.locator("a, button"), info, "selected-slide-and-cta");
  });
}

for (const width of [768, 1280]) {
  test(`desktop button geometry at ${width}px`, async ({ page }, info) => {
    await story(page, "common-button--all-variants", width);
    // The first eight are primary: two buttons per size, with and without icons.
    const buttons = page.getByRole("button");
    for (const [index, height] of [
      [0, 32],
      [2, 44],
      [4, 48],
      [6, 56],
    ]) {
      expect((await buttons.nth(index).boundingBox())!.height).toBe(height);
    }
    await noOverflow(page);
    await capture(page, info, "desktop-buttons.png", true);
  });
}

test("booking control switches at the 640px breakpoint", async ({ page }) => {
  for (const width of [639, 640]) {
    await story(page, "layout-navbar--default", width);
    const booking = page.getByRole("link", { name: "Book Now" });
    await expect(booking).toBeVisible();
    expect(
      await booking.evaluate((element) => getComputedStyle(element).position),
    ).toBe(width < 640 ? "fixed" : "static");
    await noOverflow(page);
  }
});
