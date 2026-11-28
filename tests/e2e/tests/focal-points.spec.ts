import { createId } from "@paralleldrive/cuid2";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page as BrowserPage } from "@playwright/test";
import { readImageManifest, type Media } from "@lapuertahostels/payload-types";
import { readFile } from "node:fs/promises";
import { MongoClient, ObjectId } from "mongodb";
import { create, createPage } from "../common/cms";

test.setTimeout(90_000);

let cleanupPaths: string[];

test.beforeEach(async ({ page }) => {
  cleanupPaths = [];
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
});

test.afterEach(async ({ request }) => {
  for (const path of cleanupPaths.reverse()) await request.delete(cmsUrl(path));
});

function cmsUrl(path: string) {
  return new URL(path, process.env.CMS_BASE_URL).toString();
}

async function uploadPhoto(
  request: APIRequestContext,
  asset = "david-hertle-3YCkAhD--Ic-unsplash.jpg",
) {
  const response = await request.post(cmsUrl("/api/media"), {
    multipart: {
      file: {
        name: `focal-${createId()}.jpg`,
        mimeType: "image/jpeg",
        buffer: await readFile(`./assets/${asset}`),
      },
      _payload: JSON.stringify({ alt: "Focal point test courtyard" }),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const media = (await response.json()).doc as Media;
  cleanupPaths.push(`/api/media/${media.id}`);
  return media;
}

async function openPicker(page: BrowserPage, media: Media) {
  await page.goto(cmsUrl(`/admin/collections/media/${media.id}`), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("form.collection-edit__form")).toHaveAttribute(
    "data-form-ready",
    "true",
  );
  await page
    .locator(".file-details")
    .getByRole("button", { name: /edit/i })
    .click();
  const picker = page.locator(".edit-upload");
  await expect(picker).toBeVisible();
  await expect(picker.locator("img")).toHaveJSProperty("complete", true);
  return picker;
}

async function saveAndVerifyFocalPoint(
  page: BrowserPage,
  request: APIRequestContext,
  media: Media,
  point = { x: 0, y: 100 },
) {
  const picker = await openPicker(page, media);
  await expect(picker.locator(".ReactCrop")).toHaveCount(0);
  await picker.locator('input[name="X %"]').fill(String(point.x));
  await picker.locator('input[name="Y %"]').fill(String(point.y));
  await picker
    .getByRole("button", { name: "Apply Changes", exact: true })
    .click();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes(`/api/media/${media.id}`),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await saveResponse;
  expect(saved.ok(), await saved.text()).toBeTruthy();
  // Focal-only changes must not submit a destructive crop.
  expect(
    new URL(saved.url()).searchParams.get("uploadEdits[crop][width]"),
  ).toBeNull();
  const reopened = await openPicker(page, media);
  await expect(reopened.locator('input[name="X %"]')).toHaveValue(
    String(point.x),
  );
  await expect(reopened.locator('input[name="Y %"]')).toHaveValue(
    String(point.y),
  );
  await test.info().attach("saved-focal-point", {
    body: await reopened.screenshot({
      animations: "disabled",
      path: test.info().outputPath("saved-focal-point.png"),
    }),
    contentType: "image/png",
  });
  await reopened.getByRole("button", { name: "Cancel", exact: true }).click();
  const persistedResponse = await request.get(cmsUrl(`/api/media/${media.id}`));
  const persisted = await persistedResponse.json();
  expect(persisted).toMatchObject({
    focalX: point.x,
    focalY: point.y,
    filename: media.filename,
    width: media.width,
    height: media.height,
    filesize: media.filesize,
  });
}

async function verifyFrontendFocalPoint(
  page: BrowserPage,
  request: APIRequestContext,
  media: Media,
) {
  const content = await createPage({
    hero: [
      {
        blockType: "HeroSlides",
        seoPageHeading: "Focal point test",
        slides: [{ image: media.id, imageAlignment: "bottom" }],
      },
    ],
    seo: { image: media.id },
    content: [{ blockType: "WideImage", image: media.id }],
  });
  cleanupPaths.push(`/api/pages/${content.id}`);
  const populated = await request.get(
    cmsUrl(`/api/pages/${content.id}?depth=2`),
  );
  expect((await populated.json()).hero[0].slides[0].image).toMatchObject({
    focalX: 0,
    focalY: 100,
  });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${content.pathname}?skipcache=true`);
    const image = page.getByTestId("full-image");
    await expect(image).toHaveCSS("object-position", "0% 100%");
    await expect(image).toHaveAttribute("srcset", /optimized\//);
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
    const rendered = await image.evaluate((element: HTMLImageElement) => ({
      src: element.currentSrc,
      requiredWidth:
        Math.max(element.clientWidth, (element.clientHeight * 4) / 3) *
        devicePixelRatio,
    }));
    const availableWidth = Math.max(
      ...readImageManifest(media.imageVariants)!
        .variants.filter((v) => v.preset === "landscape")
        .map((v) => v.width),
    );
    const selectedWidth = Number(
      /-(\d+)x\d+\.webp$/.exec(new URL(rendered.src).pathname)?.[1],
    );
    expect(selectedWidth).toBeGreaterThanOrEqual(
      Math.min(rendered.requiredWidth, availableWidth),
    );
    await expect(page.locator('meta[name="og:image"]')).toHaveAttribute(
      "content",
      /optimized\//,
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /optimized\//,
    );
    await test.info().attach(`focal-hero-${width}`, {
      body: await image.screenshot({
        animations: "disabled",
        path: test.info().outputPath(`focal-hero-${width}.png`),
      }),
      contentType: "image/png",
    });
  }
}

async function loginEditor(page: BrowserPage) {
  const email = `focal-${createId()}@example.com`;
  const password = createId();
  const editor = await create("users", { email, password, role: "editor" });
  cleanupPaths.push(`/api/users/${editor.id}`);
  await page.context().setExtraHTTPHeaders({});
  const login = await page.request.post(cmsUrl("/api/users/login"), {
    data: { email, password },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
}

test("editors save and reopen edge focal points and the frontend respects them", async ({
  page,
  request,
}) => {
  const media = await uploadPhoto(request);
  await loginEditor(page);
  await saveAndVerifyFocalPoint(page, request, media);
  await verifyFrontendFocalPoint(page, request, media);
});

test("legacy media without focal metadata retains hero alignment", async ({
  page,
  request,
}) => {
  const media = await uploadPhoto(request);
  const client = new MongoClient(
    process.env.CMS_DATABASE_URI ?? "mongodb://localhost:27017/website-cms",
  );
  try {
    await client.connect();
    await client
      .db()
      .collection("media")
      .updateOne(
        { _id: new ObjectId(media.id) },
        { $unset: { focalX: "", focalY: "" } },
      );
    const content = await createPage({
      hero: [
        {
          blockType: "HeroSlides",
          seoPageHeading: "Focal point test",
          slides: [{ image: media.id, imageAlignment: "bottom" }],
        },
      ],
    });
    cleanupPaths.push(`/api/pages/${content.id}`);
    await page.goto(`${content.pathname}?skipcache=true`);
    const image = page.getByTestId("full-image");
    await expect(image).toHaveCSS("object-position", "50% 90%");
    expect(await image.getAttribute("srcset")).not.toContain("xc-");
  } finally {
    await client.close();
  }
});

test("EXIF-oriented uploads keep focal subjects in hero, gallery and social crops", async ({
  page,
  request,
}) => {
  const media = await uploadPhoto(request, "courtyard-orientation-6.jpg");
  expect(media).toMatchObject({
    width: 1280,
    height: 854,
    displayWidth: 854,
    displayHeight: 1280,
  });
  const original = await (await request.get(media.url!)).body();
  await loginEditor(page);
  const picker = await openPicker(page, media);
  await expect(picker.locator("img")).toHaveJSProperty("naturalWidth", 854);
  await expect(picker.locator("img")).toHaveJSProperty("naturalHeight", 1280);
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await saveAndVerifyFocalPoint(page, request, media, { x: 50, y: 90 });
  expect(await (await request.get(media.url!)).body()).toEqual(original);
  const content = await createPage({
    hero: [
      {
        blockType: "HeroSlides",
        seoPageHeading: "Oriented focal point",
        slides: [{ image: media.id }],
      },
    ],
    content: [
      {
        blockType: "RoomList",
        rooms: [{ heading: "Oriented room", images: [{ image: media.id }] }],
      },
    ],
    seo: { image: media.id },
  });
  cleanupPaths.push(`/api/pages/${content.id}`);
  await page.goto(`${content.pathname}?skipcache=true`);
  await expect(page.getByTestId("full-image")).toHaveAttribute(
    "srcset",
    /optimized\//,
  );
  await expect(page.locator('meta[name="og:image"]')).toHaveAttribute(
    "content",
    /optimized\//,
  );
  const galleryImage = page
    .getByRole("button")
    .filter({
      has: page.getByRole("img", { name: "Focal point test courtyard" }),
    })
    .getByRole("img");
  await expect(galleryImage).toHaveAttribute("srcset", /optimized\//);
});
