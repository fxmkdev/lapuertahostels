import { expect, test } from "@playwright/test";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";

for (const scheduler of ["idle callback", "timeout fallback"] as const) {
  test(`hydrates and navigates with ${scheduler}`, async ({
    page,
    request,
  }) => {
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

    // Authenticate only our CMS requests; cross-origin fonts reject API-key headers.
    await page.context().setExtraHTTPHeaders({});

    if (scheduler === "timeout fallback") {
      await page.addInitScript(() => {
        Object.defineProperty(window, "requestIdleCallback", {
          value: undefined,
          configurable: true,
        });
      });
    }

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

    // Inspect the actual server response before the browser can enhance it.
    const response = await request.get(`/en${source.pathname}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Server rendered heading");
    expect(html).toContain("Continue to destination");

    await page.goto(`/en${source.pathname}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(/Hydration source/);
    await expect(
      page.getByRole("heading", { name: "Server rendered heading" }),
    ).toBeVisible();
    expect(await page.evaluate(() => typeof window.requestIdleCallback)).toBe(
      scheduler === "idle callback" ? "function" : "undefined",
    );
    const documentStarted = await page.evaluate(() => performance.timeOrigin);

    // A working menu proves hydration finished before checking SPA navigation.
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Español" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Continue to destination" }).click();
    await expect(page).toHaveURL(new RegExp(`/en${destination.pathname}$`));
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

    // The mobile menu and dialog exercise Headless UI portals and locale forms.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open main menu" }).click();
    await page.getByRole("menuitem", { name: "English", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Español", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Español", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/es${destination.pathname}$`));
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
    expect(errors).toEqual([]);
  });
}
