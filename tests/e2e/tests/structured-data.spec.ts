import { expect, test } from "@playwright/test";
import type {
  Page as BrowserPage,
  Response as BrowserResponse,
} from "@playwright/test";
import type { Page as CmsPage } from "@lapuertahostels/payload-types";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage, getPuertaBrand } from "../common/cms";

type Graph = {
  "@context": string;
  "@graph": {
    "@type": string;
    "@id": string;
    name?: string;
    url?: string;
    inLanguage?: string | string[];
  }[];
};

test("serves CMS-backed JSON-LD and replaces it on client navigation", async ({
  page,
}) => {
  const brand = await getPuertaBrand();
  const nextPage = await createPage({ title: "Second structured data page" });
  const firstPage = await createPage({
    title:
      'CMS "quotes" — ¡Hola! </script><script>window.jsonLdInjected=true</script>',
    content: [
      {
        blockType: "LeadText",
        text: richTextRoot(paragraph(text("Choose the next page"))),
        cta: {
          show: true,
          label: "Next structured data page",
          link: { linkType: "internal", doc: nextPage.id },
        },
      },
    ],
  });

  const response = await page.goto(
    `/en${firstPage.pathname}?utm_source=structured-data-test`,
  );
  const graph = await expectServerGraph(page, response!, firstPage, brand.name);
  const nextTitle = brand.baseTitle
    ? `${nextPage.title} · ${brand.baseTitle}`
    : nextPage.title!;
  await expectClientNavigation(page, nextPage.pathname, nextTitle);

  await page.goto(`/es${firstPage.pathname}`);
  const spanish: Graph = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(spanish["@graph"].slice(0, 3).map((node) => node["@id"])).toEqual(
    graph["@graph"].slice(0, 3).map((node) => node["@id"]),
  );
  expect(spanish["@graph"][3].inLanguage).toBe("es");
});

async function expectServerGraph(
  page: BrowserPage,
  response: BrowserResponse,
  content: Pick<CmsPage, "title" | "pathname">,
  brandName: string,
) {
  expect(response.status()).toBe(200);
  const html = await response.text();
  const scripts = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  expect(scripts).toHaveLength(1);
  const graph: Graph = JSON.parse(scripts[0][1]);
  expect(graph["@context"]).toBe("https://schema.org");
  expect(graph["@graph"].map((node) => node["@type"])).toEqual([
    "Organization",
    "Brand",
    "WebSite",
    "WebPage",
  ]);
  expect(graph["@graph"][0].name).toBe(brandName);
  expect(graph["@graph"][1].name).toBe(brandName);
  const webpage = graph["@graph"][3];
  expect(webpage.name).toBe(await page.title());
  expect(webpage.name).toContain(content.title);
  expect(webpage.url).toBe(new URL(`/en${content.pathname}`, page.url()).href);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    webpage.url!,
  );
  expect(await page.evaluate(() => "jsonLdInjected" in window)).toBe(false);
  return graph;
}

async function expectClientNavigation(
  page: BrowserPage,
  pathname: string,
  title: string,
) {
  const url = new URL(`/en${pathname}`, page.url()).href;
  // A document-only marker survives SPA navigation, proving this did not reload.
  await page.evaluate(() => {
    document.documentElement.dataset.spaMarker = "present";
  });
  await page.getByRole("link", { name: "Next structured data page" }).click();
  await expect(page).toHaveURL(url);
  await expect(page).toHaveTitle(title);
  await expect(page.locator("html")).toHaveAttribute(
    "data-spa-marker",
    "present",
  );
  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (JSON.parse((await jsonLd.textContent())!) as Graph)["@graph"][3],
    )
    .toMatchObject({ name: title, url, "@id": `${url}#webpage` });
}

test("omits structured data on preview, login, and missing pages", async ({
  page,
}) => {
  const content = await createPage();
  for (const pathname of [
    `/en${content.pathname}?preview=`,
    "/en/login",
    `/en${content.pathname}/missing`,
  ]) {
    const response = await page.goto(pathname);
    expect(await response!.text()).not.toContain('type="application/ld+json"');
    await expect(
      page.locator('script[type="application/ld+json"]'),
    ).toHaveCount(0);
  }
});
