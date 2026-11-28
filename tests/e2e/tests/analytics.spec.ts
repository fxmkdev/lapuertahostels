import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";

test.skip(
  !process.env.ANALYTICS_SCRIPT_URL,
  "Set ANALYTICS_SCRIPT_URL on the frontend and test runner to verify the real tracker",
);

type AnalyticsEvent = { n: string; u: string; d: string; p?: object };

async function createAnalyticsPages() {
  const destination = await createPage({
    title: "Analytics destination",
    hero: [{ blockType: "HeroHeading", heading: "Analytics destination" }],
  });
  const source = await createPage({
    title: "Analytics source",
    hero: [{ blockType: "HeroHeading", heading: "Analytics source" }],
    content: [
      {
        blockType: "LeadText",
        text: richTextRoot(paragraph(text("Analytics navigation check"))),
        cta: {
          show: true,
          label: "Continue tracking check",
          link: { linkType: "custom", url: `/en${destination.pathname}` },
        },
      },
    ],
  });

  return { source, destination };
}

async function captureTracking(page: Page) {
  const events: AnalyticsEvent[] = [];
  const trackingRequests: string[] = [];
  const thirdPartyRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["/js/script.js", "/api/event"].includes(url.pathname)) {
      trackingRequests.push(request.url());
    }
  });
  await page.route("https://plausible.io/**", async (route) => {
    thirdPartyRequests.push(route.request().url());
    await route.abort();
  });
  // Keep the real script response, but capture events before they reach the
  // server proxy so this test never adds visits to the site's Plausible stats.
  await page.route("**/api/event", async (route) => {
    events.push(route.request().postDataJSON() as AnalyticsEvent);
    await route.fulfill({ status: 202, body: "{}" });
  });
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await enableLocalCapture(page);
  return { events, trackingRequests, thirdPartyRequests };
}

async function enableLocalCapture(page: Page) {
  await page.addInitScript(() => {
    // Preserve the production endpoint configuration while enabling capture in
    // localhost/automated browsers only for this test's page.
    const tracker = Object.assign(
      (...args: unknown[]) => tracker.q.push(args),
      {
        q: [] as unknown[][],
        o: {} as Record<string, unknown>,
        init(options: Record<string, unknown>) {
          tracker.o = { ...options, captureOnLocalhost: true };
        },
      },
    );
    Object.assign(window, { plausible: tracker });
  });
}

async function navigateTrackedPages(
  page: Page,
  { source, destination }: Awaited<ReturnType<typeof createAnalyticsPages>>,
  events: AnalyticsEvent[],
) {
  const pageviews = () => events.filter((event) => event.n === "pageview");
  await page.goto(`/en${source.pathname}`);
  await expect(
    page.getByRole("heading", { name: "Analytics source" }),
  ).toBeVisible();
  await expect.poll(() => pageviews().length).toBe(1);
  const documentStarted = await page.evaluate(() => performance.timeOrigin);

  // Wait for hydration before clicking the React Router link.
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Español" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Continue tracking check" }).click();
  await expect(
    page.getByRole("heading", { name: "Analytics destination" }),
  ).toBeVisible();
  await expect.poll(() => pageviews().length).toBe(2);

  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Analytics source" }),
  ).toBeVisible();
  await expect.poll(() => pageviews().length).toBe(3);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Analytics destination" }),
  ).toBeVisible();
  await expect.poll(() => pageviews().length).toBe(4);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    documentStarted,
  );
}

test("real tracker sends first-party pageviews and custom events without duplicates", async ({
  page,
}) => {
  const pages = await createAnalyticsPages();
  const { source, destination } = pages;
  const { events, trackingRequests, thirdPartyRequests } =
    await captureTracking(page);
  await navigateTrackedPages(page, pages, events);
  const pageviews = () => events.filter((event) => event.n === "pageview");

  await page.evaluate(() => {
    const tracker = Reflect.get(window, "plausible") as (
      event: string,
      options: object,
    ) => void;
    tracker("Proxy verification", { props: { source: "automated-test" } });
  });
  await expect
    .poll(
      () => events.filter((event) => event.n === "Proxy verification").length,
    )
    .toBe(1);
  expect(events.find((event) => event.n === "Proxy verification")?.p).toEqual({
    source: "automated-test",
  });
  expect(pageviews().map((event) => new URL(event.u).pathname)).toEqual([
    `/en${source.pathname}`,
    `/en${destination.pathname}`,
    `/en${source.pathname}`,
    `/en${destination.pathname}`,
  ]);
  expect(events.every((event) => event.d === "lapuertahostels.co")).toBe(true);
  expect(thirdPartyRequests).toEqual([]);
  expect(
    trackingRequests.every(
      (url) => new URL(url).origin === new URL(page.url()).origin,
    ),
  ).toBe(true);
  expect(
    trackingRequests.filter((url) => new URL(url).pathname === "/js/script.js"),
  ).toHaveLength(1);
});
