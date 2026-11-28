import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { createId } from "@paralleldrive/cuid2";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { create, createPage, get, ensurePreviewHomepages } from "../common/cms";

test.use({ actionTimeout: 15_000 });

test("cookie-authenticated CMS populates cross-site iframe and popup previews without saving", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const cmsOrigin = new URL(process.env.CMS_BASE_URL!).origin;
  const document = await createPage({
    content: [
      {
        blockType: "Story",
        heading: "Saved preview heading",
        text: richTextRoot(paragraph(text("Preview test body"))),
      },
    ],
  });
  const context = await createCookieContext(browser, cmsOrigin);
  try {
    const page = await context.newPage();
    const populations: boolean[] = [];
    page.on("request", (request) => {
      if (
        request.url().startsWith(`${cmsOrigin}/api/pages/${document.id}`) &&
        request.method() === "POST"
      ) {
        populations.push(request.frame() === page.mainFrame());
      }
    });
    await page.goto(`${cmsOrigin}/admin/collections/pages/${document.id}`);
    await page
      .getByRole("button", { name: "Live Preview", exact: true })
      .click();
    const preview = page.frameLocator("#live-preview-iframe");
    await expect(
      preview.getByRole("heading", { name: "Saved preview heading" }),
    ).toBeVisible();
    expect(
      new URL(
        (await page.locator("#live-preview-iframe").getAttribute("src")) ?? "",
      ).origin,
    ).toBe(new URL(process.env.FRONTEND_BASE_URL!).origin);

    await expectDirectRequestForbidden(page, cmsOrigin, `pages/${document.id}`);
    populations.length = 0;

    await page
      .locator(".tabs-field__tab-button")
      .filter({ hasText: /^Content$/ })
      .click();
    const showAll = page.getByRole("button", { name: "Show All", exact: true });
    if (await showAll.isVisible()) await showAll.click();
    const heading = page.getByRole("textbox", { name: /^Heading/ });
    await heading.fill("Unsaved iframe heading");
    await expect(
      preview.getByRole("heading", { name: "Unsaved iframe heading" }),
    ).toBeVisible();
    await expect(preview.getByRole("alert")).toHaveCount(0);

    const popupPromise = page.waitForEvent("popup");
    await page.getByTitle(/^Open in new window$/i).click();
    const popup = await popupPromise;
    await expect(
      popup.getByRole("heading", { name: "Unsaved iframe heading" }),
    ).toBeVisible();
    await heading.fill("Unsaved popup heading");
    await expect(
      popup.getByRole("heading", { name: "Unsaved popup heading" }),
    ).toBeVisible();
    await expect(popup.getByRole("alert")).toHaveCount(0);
    expect(populations.length).toBeGreaterThan(0);
    expect(populations.every(Boolean)).toBe(true);
    const saved = await get(`pages/${document.id}?locale=en&depth=0`);
    expect(saved.content[0].heading).toBe("Saved preview heading");
  } finally {
    await context.close();
  }
});

async function createCookieContext(browser: Browser, cmsOrigin: string) {
  const email = `preview-${createId()}@example.com`;
  const password = `Test-${createId()}!`;
  await create("users", { email, password, role: "editor" });
  // Do not inherit the suite's API-key headers: this regression must use only cookies.
  const context = await browser.newContext({ extraHTTPHeaders: {} });
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await context.route(
    (url) =>
      url.origin !== cmsOrigin &&
      /\.(png|jpe?g|webp|avif|svg)$/.test(url.pathname),
    (route) =>
      route.fulfill({
        path: "assets/logo-puerta-simple.png",
        contentType: "image/png",
      }),
  );
  const login = await context.request.post(`${cmsOrigin}/api/users/login`, {
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  expect(
    (await context.cookies(cmsOrigin)).some(
      (cookie) => cookie.name === "payload-token" && cookie.sameSite === "Lax",
    ),
  ).toBe(true);
  return context;
}

async function expectDirectRequestForbidden(
  page: Page,
  cmsOrigin: string,
  documentPath: string,
) {
  // Prove the original cookie-based cross-site request remains forbidden.
  const frontendOrigin = new URL(process.env.FRONTEND_BASE_URL!).origin;
  const frame = page
    .frames()
    .find((frame) => frame.url().startsWith(`${frontendOrigin}/`));
  expect(
    frame,
    "The preview must remain on its configured cross-site origin",
  ).not.toBeNull();
  const directStatus = await frame!.evaluate(
    async ({ cmsOrigin, documentPath }) => {
      const response = await fetch(`${cmsOrigin}/api/${documentPath}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Payload-HTTP-Method-Override": "GET",
        },
        body: JSON.stringify({
          data: {},
          depth: 0,
          flattenLocales: false,
          locale: "en",
        }),
      });
      return response.status;
    },
    { cmsOrigin, documentPath },
  );
  expect(directStatus).toBe(403);
}

test.beforeAll(async () => {
  await ensurePreviewHomepages();
});

for (const target of ["banner", "footer", "common"] as const) {
  test(`cookie-authenticated ${target} preview updates iframe and popup without saving`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const cmsOrigin = new URL(process.env.CMS_BASE_URL!).origin;
    const banner =
      target === "banner"
        ? await create("banners", {
            message: "Saved unassigned banner",
            cta: { show: false },
          })
        : null;
    const documentPath = banner ? `banners/${banner.id}` : `globals/${target}`;
    const saved = await get(`${documentPath}?locale=en&depth=0`);
    const context = await createCookieContext(browser, cmsOrigin);
    try {
      const page = await context.newPage();
      const populations: boolean[] = [];
      page.on("request", (request) => {
        if (
          request.url().startsWith(`${cmsOrigin}/api/${documentPath}`) &&
          request.method() === "POST"
        )
          populations.push(request.frame() === page.mainFrame());
      });
      await page.goto(
        `${cmsOrigin}/admin/${banner ? `collections/banners/${banner.id}` : `globals/${target}`}`,
      );
      const lock = page.getByRole("dialog", { name: "document-locked" });
      if (await lock.isVisible())
        await lock
          .getByRole("button", { name: "Take over", exact: true })
          .click();
      await page
        .getByRole("button", { name: "Live Preview", exact: true })
        .click();
      const preview = page.frameLocator("#live-preview-iframe");
      await expect(preview.getByRole("combobox")).toBeVisible();
      await expectDirectRequestForbidden(page, cmsOrigin, documentPath);
      populations.length = 0;
      const field =
        target === "banner"
          ? page.getByRole("textbox", { name: /^Message/ })
          : target === "footer"
            ? page.locator('[contenteditable="true"]').first()
            : page.getByRole("textbox", { name: /^Heading/ }).first();
      await field.fill(`Unsaved ${target} iframe`);
      await expect(
        preview.getByText(`Unsaved ${target} iframe`, { exact: true }),
      ).toBeVisible();
      await expect(preview.getByRole("alert")).toHaveCount(0);
      await expect(preview.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(preview.locator('script[src="/js/script.js"]')).toHaveCount(
        0,
      );
      if (target !== "common") {
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
      } else {
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
      expect(populations.length).toBeGreaterThan(0);
      expect(populations.every(Boolean)).toBe(true);
      expect(await get(`${documentPath}?locale=en&depth=0`)).toEqual(saved);
    } finally {
      await context.close();
    }
  });
}
