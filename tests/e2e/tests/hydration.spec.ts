import { expect, test } from "@playwright/test";
import type { Page as BrowserPage } from "@playwright/test";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";

function captureBrowserErrors(page: BrowserPage) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      /hydration|hydrating|did not match|server rendered HTML/i.test(
        message.text(),
      )
    ) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function createHydrationPages() {
  const destination = await createPage({
    title: "Hydration destination",
    hero: [{ blockType: "HeroHeading", heading: "Destination heading" }],
  });
  const source = await createPage({
    title: "Hydration source",
    hero: [{ blockType: "HeroHeading", heading: "Server rendered heading" }],
    content: [
      {
        blockType: "LeadText",
        text: richTextRoot(paragraph(text("Hydration navigation check"))),
        cta: {
          show: true,
          label: "Continue to destination",
          link: { linkType: "custom", url: `/en${destination.pathname}` },
        },
      },
    ],
  });
  return { source, destination };
}

async function expectClientNavigation(
  page: BrowserPage,
  sourcePathname: string,
  destinationPathname: string,
) {
  await page.goto(`/en${sourcePathname}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/Hydration source/);
  await expect(
    page.getByRole("heading", { name: "Server rendered heading" }),
  ).toBeVisible();
  const documentStarted = await page.evaluate(() => performance.timeOrigin);

  // A working menu proves hydration finished before checking SPA navigation.
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Español" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Continue to destination" }).click();
  await expect(page).toHaveURL(new RegExp(`/en${destinationPathname}$`));
  await expect(page).toHaveTitle(/Hydration destination/);
  await expect(
    page.getByRole("heading", { name: "Destination heading" }),
  ).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    documentStarted,
  );

  await page.goBack();
  await expect(page).toHaveTitle(/Hydration source/);
  await expect(
    page.getByRole("link", { name: "Continue to destination" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveTitle(/Hydration destination/);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    documentStarted,
  );
}

async function expectMobileLocaleSwitch(
  page: BrowserPage,
  destinationPathname: string,
) {
  // The mobile menu and dialog exercise Headless UI portals and locale forms.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.getByRole("menuitem", { name: "English", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Español", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Español", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/es${destinationPathname}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle(/Hydration destination/);
  await expect(
    page.getByRole("heading", { name: "Destination heading" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.getByRole("menuitem", { name: "Español", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "English", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

for (const scheduler of ["idle callback", "timeout fallback"] as const) {
  test(`hydrates and navigates with ${scheduler}`, async ({
    page,
    request,
  }) => {
    const errors = captureBrowserErrors(page);

    // Browser requests are public; CMS fixture requests retain their API key.
    await page.context().setExtraHTTPHeaders({});
    // Font availability is outside this interaction test's hydration contract.
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ contentType: "text/css", body: "" }),
    );

    if (scheduler === "timeout fallback") {
      await page.addInitScript(() => {
        Object.defineProperty(window, "requestIdleCallback", {
          value: undefined,
          configurable: true,
        });
      });
    }

    const { source, destination } = await createHydrationPages();
    await test.step("verify the server-rendered response", async () => {
      const response = await request.get(`/en${source.pathname}`);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain("Server rendered heading");
      expect(html).toContain("Continue to destination");
    });
    await test.step("hydrate and navigate through browser history", async () => {
      await expectClientNavigation(page, source.pathname, destination.pathname);
      expect(await page.evaluate(() => typeof window.requestIdleCallback)).toBe(
        scheduler === "idle callback" ? "function" : "undefined",
      );
    });
    await test.step("switch locale through the mobile dialog", () =>
      expectMobileLocaleSwitch(page, destination.pathname));
    expect(errors).toEqual([]);
  });
}
