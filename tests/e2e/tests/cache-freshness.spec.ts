import { expect, test } from "@playwright/test";
import { createId } from "@paralleldrive/cuid2";
import { create, getMedia } from "../common/cms";

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
