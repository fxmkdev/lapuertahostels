import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { createId } from "@paralleldrive/cuid2";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { create, createPage, get } from "../common/cms";

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
    await expect(page.locator("#live-preview-iframe")).toHaveAttribute(
      "src",
      /^http:\/\/127\.0\.0\.1:3000\//,
    );

    await expectDirectRequestForbidden(page, cmsOrigin, document.id);
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
  id: string,
) {
  // Prove the original cookie-based cross-site request remains forbidden.
  const frame = page.frame({ url: /^http:\/\/127\.0\.0\.1:3000\// });
  expect(
    frame,
    "The preview must remain on its configured cross-site origin",
  ).not.toBeNull();
  const directStatus = await frame!.evaluate(
    async ({ cmsOrigin, id }) => {
      const response = await fetch(`${cmsOrigin}/api/pages/${id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Payload-HTTP-Method-Override": "GET",
        },
        body: JSON.stringify({
          data: { id },
          depth: 0,
          flattenLocales: false,
          locale: "en",
        }),
      });
      return response.status;
    },
    { cmsOrigin, id: id },
  );
  expect(directStatus).toBe(403);
}
