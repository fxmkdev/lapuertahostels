import { createId } from "@paralleldrive/cuid2";
import { expect, test, type Page } from "@playwright/test";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";
import { openMenu } from "../common/menu";

test.use({ locale: "es-MX" });

test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({});
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
});

async function translatedPage() {
  const id = createId();
  const pathnames = { en: `/e2e/${id}/contact`, es: `/e2e/${id}/contacto` };
  const page = await createPage(
    {
      title: "Language offer destination",
      hero: [{ blockType: "HeroHeading", heading: "The same destination" }],
      content: [
        {
          blockType: "LeadText",
          elementId: "directions",
          text: richTextRoot(paragraph(text("Directions"))),
        },
      ],
    },
    pathnames,
  );
  return { ...page, pathnames };
}

async function expectNoOffer(page: Page, language = "English") {
  // Opening a menu proves hydration completed before asserting absence.
  await openMenu(
    page,
    language,
    language === "English" ? "Español" : "English",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary")).toHaveCount(0);
}

async function expectSavedLocale(
  page: Page,
  pathname: string,
  destination: string,
  acceptLanguage = "es",
) {
  const response = await page.request.get(pathname, {
    maxRedirects: 0,
    headers: { "Accept-Language": acceptLanguage },
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
}

test("offers without redirecting, preserves translated destination and saves switch", async ({
  page,
  request,
}) => {
  const destination = await translatedPage();
  const incoming = `/en${destination.pathnames.en}?source=friend&tag=a&tag=b#directions`;
  const response = await request.get(incoming, {
    headers: { "Accept-Language": "es" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const html = await response.text();
  expect(html).toContain('lang="en"');
  expect(html).toContain('rel="canonical"');
  expect(html).toContain('hrefLang="es"');
  expect(html).toContain(`/es${destination.pathnames.es}`);
  expect(html).not.toContain('<aside lang="es"');

  await page.goto(incoming, { referer: "https://external.example/shared" });
  await expect(page).toHaveURL(incoming);
  const notice = page.getByRole("complementary", {
    name: "Esta página también está disponible en Español.",
  });
  await expect(notice).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const button = notice.getByRole("button", { name: "Cambiar a Español" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    `/es${destination.pathnames.es}?source=friend&tag=a&tag=b#directions`,
  );
  await expect(
    page.getByRole("heading", { name: "The same destination" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(
    (await page.context().cookies()).find((cookie) => cookie.name === "locale"),
  ).toBeDefined();

  // The saved choice wins even after the browser header changes.
  await expectSavedLocale(
    page,
    destination.pathnames.en,
    `/es${destination.pathnames.es}`,
    "en",
  );
  await page.goto(`/es${destination.pathnames.es}`);
  await expectNoOffer(page, "Español");
});

test("keeping the incoming language saves the choice and retains the exact URL", async ({
  page,
}) => {
  const destination = await translatedPage();
  const incoming = `/en${destination.pathnames.en}?source=friend#directions`;
  await page.goto(incoming);
  await page.getByRole("button", { name: "Continuar en English" }).click();
  await expect(page).toHaveURL(incoming);
  await expectSavedLocale(
    page,
    destination.pathnames.en,
    `/en${destination.pathnames.en}`,
  );
  await page.goto(incoming);
  await expectNoOffer(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("does not prompt on same-origin arrival, reload, explicit lng or history restore", async ({
  page,
}) => {
  const destination = await translatedPage();
  const incoming = `/en${destination.pathnames.en}`;
  await page.goto(incoming, {
    referer: new URL("/en", process.env.FRONTEND_BASE_URL).href,
  });
  await expectNoOffer(page);
  await page.goto(`${incoming}?lng=en`);
  await expectNoOffer(page);
  await page.goto(incoming);
  await expect(
    page.getByRole("button", { name: "Continuar en English" }),
  ).toBeVisible();
  await page.reload();
  await expectNoOffer(page);
  await page.goto(`${incoming}?next=1&lng=en`);
  await page.goBack();
  await expectNoOffer(page);
});

test("internal client navigation never opens or rearms the offer", async ({
  page,
}) => {
  const destination = await translatedPage();
  const source = await createPage({
    content: [
      {
        blockType: "LeadText",
        text: richTextRoot(paragraph(text("Start here"))),
        cta: {
          show: true,
          label: "Continue internally",
          link: { linkType: "custom", url: `/en${destination.pathname}` },
        },
      },
    ],
  });
  await page.goto(`/en${source.pathname}`);
  await expect(
    page.getByRole("button", { name: "Continuar en English" }),
  ).toBeVisible();
  const started = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("link", { name: "Continue internally" }).click();
  await expect(page).toHaveURL(`/en${destination.pathname}`);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(started);
  await page.goBack();
  await expect(page.getByRole("complementary")).toHaveCount(0);
});

for (const mobile of [false, true]) {
  test(`respects deliberate ${mobile ? "mobile" : "desktop"} language selections`, async ({
    page,
  }) => {
    const destination = await translatedPage();
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/es${destination.pathnames.es}?source=manual#directions`);
    if (mobile) {
      await (await openMenu(page, "Open main menu", "Español")).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "English", exact: true })
        .click();
    } else {
      await (await openMenu(page, "Español", "English")).click();
    }
    await expect(page).toHaveURL(
      `/en${destination.pathnames.en}?source=manual#directions`,
    );
    await expectSavedLocale(
      page,
      destination.pathnames.en,
      `/en${destination.pathnames.en}`,
    );
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await page.goto(`/en${destination.pathnames.en}`);
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });
}
