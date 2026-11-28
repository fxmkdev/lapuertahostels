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
          environment: { imagekitBaseUrl: "https://images.example.com" },
        },
      },
    ],
  } as never);
}

test("social previews use the same focal geometry at their respective sizes", () => {
  const result = socialMetadata(0, 100);
  expect(result).toContainEqual({
    name: "og:image",
    content:
      "https://images.example.com/tr:w-1200,h-630,xc-600,yc-315/subject.jpg",
  });
  expect(result).toContainEqual({
    name: "twitter:image",
    content:
      "https://images.example.com/tr:w-2400,h-1200,xc-1200,yc-600/subject.jpg",
  });
});

test("social URLs without focal metadata preserve existing transformations", () => {
  expect(socialMetadata()).toContainEqual({
    name: "og:image",
    content: "https://images.example.com/tr:w-1200,h-630/subject.jpg",
  });
});

test("social crops use the displayed portrait dimensions for EXIF rotations", () => {
  const result = socialMetadata(50, 90, {
    width: 1280,
    height: 854,
    displayWidth: 854,
    displayHeight: 1280,
  });
  expect(result).toContainEqual({
    name: "og:image",
    content:
      "https://images.example.com/tr:w-1200,h-630,xc-600,yc-1484/subject.jpg",
  });
});
