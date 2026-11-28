import { expect, test, vi } from "vitest";
import { meta } from "~/routes/$";
import { media } from "./cms-data.builders";

vi.mock("~/common/routing.server", () => ({
  handleIncomingRequest: vi.fn(),
  handlePathname: vi.fn(),
}));
vi.mock("~/cms-data.server", () => ({
  getSettings: vi.fn(),
  tryGetLocalizedPathname: vi.fn(),
}));

function socialMetadata(focalX?: number, focalY?: number, dimensions = {}) {
  return meta({
    loaderData: {
      content: {
        title: "Test",
        seo: {
          image: {
            ...media("subject.jpg"),
            width: 1600,
            height: 800,
            focalX,
            focalY,
            ...dimensions,
          },
        },
      },
      alternateUrls: [],
      publishedLocaleCodes: ["en"],
      canonicalUrl: "https://example.com/",
    },
    matches: [
      {
        id: "root",
        meta: [],
        loaderData: {
          locale: "en",
          allBrands: [{ id: "puerta", name: "La Puerta" }],
          environment: { mediaBaseUrl: "https://images.example.com" },
        },
      },
    ],
  } as never);
}

test("legacy social previews use direct original URLs and actual dimensions", () => {
  const result = socialMetadata(0, 100);
  expect(result).toContainEqual({
    name: "og:image",
    content: "https://images.example.com/subject.jpg",
  });
  expect(result).toContainEqual({ name: "og:image:width", content: "1600" });
});
test("social previews use immutable JPEG derivatives when available", () => {
  const imageVariants = {
    recipeVersion: 1,
    sourceHash: "a".repeat(64),
    focalX: 0,
    focalY: 100,
    variants: [
      {
        preset: "opengraph",
        key: "optimized/og.jpg",
        width: 1200,
        height: 630,
        mimeType: "image/jpeg",
        focalX: 0,
        focalY: 100,
        sha256: "b".repeat(64),
      },
      {
        preset: "twitter",
        key: "optimized/twitter.jpg",
        width: 2400,
        height: 1200,
        mimeType: "image/jpeg",
        focalX: 0,
        focalY: 100,
        sha256: "b".repeat(64),
      },
    ],
  };
  const result = socialMetadata(0, 100, {
    imageVariants,
    mimeType: "image/png",
  });
  expect(result).toContainEqual({
    name: "og:image",
    content: "https://images.example.com/optimized/og.jpg",
  });
  expect(result).toContainEqual({
    name: "twitter:image",
    content: "https://images.example.com/optimized/twitter.jpg",
  });
  expect(result).toContainEqual({
    name: "og:image:type",
    content: "image/jpeg",
  });
});
