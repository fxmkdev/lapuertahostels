import { expect, test } from "@playwright/test";
import { createId } from "@paralleldrive/cuid2";
import { create, createPage, get, getMedia } from "../common/cms";

test("the first page request after a related banner save contains the updated content", async ({
  page,
  request,
}) => {
  const id = createId();
  const pathname = `/e2e/cache-${id}`;
  const originalMessage = `Original promotion ${id}`;
  const updatedMessage = `Updated promotion ${id}`;
  const logo = await getMedia("logo-puerta-simple.png");
  expect(logo).toBeTruthy();

  const records: { collection: string; id: string }[] = [];
  try {
    const banner = await create("banners", {
      message: originalMessage,
      cta: { show: false },
    });
    records.unshift({ collection: "banners", id: banner.id });
    const brand = await create("brands", {
      id: `cache-${id}`,
      name: `Cache freshness ${id}`,
      rootPath: pathname,
      themeColor: "puerta",
      logo: logo!.id,
      banner: banner.id,
    });
    records.unshift({ collection: "brands", id: brand.id });
    const contentPage = await create("pages", {
      pathname,
      title: `Cache freshness ${id}`,
      brand: brand.id,
      hero: [{ blockType: "HeroHeading", heading: "Cache freshness" }],
    });
    records.unshift({ collection: "pages", id: contentPage.id });

    await page.goto(pathname);
    await expect(
      page.getByText(originalMessage, { exact: true }),
    ).toBeVisible();

    const saved = await request.patch(
      new URL(
        `/api/banners/${banner.id}?locale=en`,
        process.env.CMS_BASE_URL,
      ).toString(),
      {
        data: { message: updatedMessage },
      },
    );
    expect(saved.status(), await saved.text()).toBe(200);

    // No cache bypass, delay, polling, or banner dismissal. Inspect the first
    // server response as well as the hydrated UI.
    const response = await page.reload();
    expect(response!.status()).toBe(200);
    expect(await response!.text()).toContain(updatedMessage);
    expect(await response!.text()).not.toContain(originalMessage);
    await expect(page.getByText(updatedMessage, { exact: true })).toBeVisible();
  } finally {
    for (const record of records) {
      const response = await request.delete(
        new URL(
          `/api/${record.collection}/${record.id}`,
          process.env.CMS_BASE_URL,
        ).toString(),
      );
      expect(response.ok(), await response.text()).toBe(true);
    }
  }
});

test("a UI label save updates the first reload without a hydration mismatch", async ({
  page,
  request,
}) => {
  const common = await get("globals/common?locale=en");
  const updatedHeading = `Updated footer ${createId()}`;
  const contentPage = await createPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  const commonUrl = new URL(
    "/api/globals/common?locale=en",
    process.env.CMS_BASE_URL,
  ).toString();

  try {
    // Warm both the server translation resources and the browser label fetch.
    await page.goto(`/en${contentPage.pathname}`);
    await expect(page.locator("#footer-heading")).toHaveText(
      common.uiLabels.footer.heading,
    );
    const labels = await page.evaluate(async () => {
      const response = await fetch("/api/ui-labels?lng=en");
      return {
        labels: await response.json(),
        cacheControl: response.headers.get("Cache-Control"),
      };
    });
    expect(labels.labels.footer.heading).toBe(common.uiLabels.footer.heading);
    expect(labels.cacheControl).toBe("no-store");

    const saved = await request.post(commonUrl, {
      data: { uiLabels: { footer: { heading: updatedHeading } } },
    });
    expect(saved.status(), await saved.text()).toBe(200);

    const response = await page.reload();
    expect(response!.status()).toBe(200);
    expect(await response!.text()).toContain(updatedHeading);
    await expect(page.locator("#footer-heading")).toHaveText(updatedHeading);
    // Opening the menu waits for hydration, rather than checking only SSR text.
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Español" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    const restored = await request.post(commonUrl, {
      data: { uiLabels: { footer: common.uiLabels.footer } },
    });
    expect(restored.ok(), await restored.text()).toBe(true);
  }
});
