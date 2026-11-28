import { expect, test } from "@playwright/test";
import { createId } from "@paralleldrive/cuid2";
import { readFile } from "node:fs/promises";
import { readImageManifest, type Media } from "@lapuertahostels/payload-types";
import { createPage } from "../common/cms";

test.setTimeout(120_000);
const cmsUrl = (path: string) =>
  new URL(path, process.env.CMS_BASE_URL).toString();
const cleanup: string[] = [];
test.afterEach(async ({ request }) => {
  for (const path of cleanup.splice(0).reverse())
    await request.delete(cmsUrl(path));
});

test("uploads and replacements preserve originals and publish immutable WebP files", async ({
  page,
  request,
}) => {
  const uploaded = await readFile(
    "./assets/david-hertle-3YCkAhD--Ic-unsplash.jpg",
  );
  const response = await request.post(cmsUrl("/api/media"), {
    multipart: {
      file: {
        name: `delivery-${createId()}.jpg`,
        mimeType: "image/jpeg",
        buffer: uploaded,
      },
      _payload: JSON.stringify({ alt: "Delivery photo" }),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  let media = (await response.json()).doc as Media;
  cleanup.push(`/api/media/${media.id}`);
  expect(
    await (
      await request.get(media.url!, { headers: { Authorization: "" } })
    ).body(),
  ).toEqual(uploaded);
  const originalManifest = readImageManifest(media.imageVariants)!;
  expect(originalManifest).toBeDefined();
  const content = await createPage({
    hero: [
      {
        blockType: "HeroSlides",
        seoPageHeading: "Delivery",
        slides: [{ image: media.id }],
      },
    ],
    seo: { image: media.id },
  });
  cleanup.push(`/api/pages/${content.id}`);
  const forbiddenRequests: string[] = [];
  page.on("request", (req) => {
    if (/imagekit|amazonaws\.com/.test(req.url()))
      forbiddenRequests.push(req.url());
  });
  await page.goto(content.pathname!);
  const image = page.getByTestId("full-image");
  await expect(image).toHaveJSProperty("complete", true);
  const oldUrl = await image.evaluate((el: HTMLImageElement) => el.currentSrc);
  const oldResponse = await request.get(oldUrl, {
    headers: { Authorization: "" },
  });
  expect(oldResponse.headers()["content-type"]).toContain("image/webp");
  expect(oldResponse.headers()["cache-control"]).toContain("immutable");
  const oldBytes = await oldResponse.body();

  const focal = await request.patch(cmsUrl(`/api/media/${media.id}`), {
    data: { focalX: 100, focalY: 0 },
  });
  expect(focal.ok(), await focal.text()).toBeTruthy();
  media = (await focal.json()).doc;
  expect(readImageManifest(media.imageVariants)?.variants[0].key).not.toBe(
    originalManifest.variants[0].key,
  );
  await page.reload();
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.currentSrc))
    .not.toBe(oldUrl);
  expect(
    await (
      await request.get(oldUrl, { headers: { Authorization: "" } })
    ).body(),
  ).toEqual(oldBytes);
  expect(
    await (
      await request.get(media.url!, { headers: { Authorization: "" } })
    ).body(),
  ).toEqual(uploaded);

  const replacement = await readFile("./assets/courtyard-orientation-6.jpg");
  const changed = await request.patch(cmsUrl(`/api/media/${media.id}`), {
    multipart: {
      file: {
        name: `replacement-${createId()}.jpg`,
        mimeType: "image/jpeg",
        buffer: replacement,
      },
      _payload: "{}",
    },
  });
  expect(changed.ok(), await changed.text()).toBeTruthy();
  const replaced = (await changed.json()).doc as Media;
  expect(replaced.id).toBe(media.id);
  expect(readImageManifest(replaced.imageVariants)?.sourceHash).not.toBe(
    originalManifest.sourceHash,
  );
  expect(
    await (
      await request.get(replaced.url!, { headers: { Authorization: "" } })
    ).body(),
  ).toEqual(replacement);
  expect(forbiddenRequests).toEqual([]);
});

test("video playback and byte ranges are delivered directly by Tigris", async ({
  page,
  request,
}) => {
  const recording = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    canvas.getContext("2d")!.fillRect(0, 0, 64, 64);
    await new Promise((resolve) => setTimeout(resolve, 500));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  const bytes = Buffer.from(recording);
  const uploaded = await request.post(cmsUrl("/api/media"), {
    multipart: {
      file: {
        name: `video-${createId()}.webm`,
        mimeType: "video/webm",
        buffer: bytes,
      },
      _payload: JSON.stringify({ alt: "Test video" }),
    },
  });
  expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
  const media = (await uploaded.json()).doc as Media;
  cleanup.push(`/api/media/${media.id}`);
  const range = await request.get(media.url!, {
    headers: { Authorization: "", Range: "bytes=0-15" },
  });
  expect(range.status()).toBe(206);
  expect(await range.body()).toEqual(bytes.subarray(0, 16));
  const content = await createPage({
    hero: [{ blockType: "HeroVideo", video: media.id }],
  });
  cleanup.push(`/api/pages/${content.id}`);
  await page.goto(content.pathname!);
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /tigrisfiles\.io/);
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(2);
});
