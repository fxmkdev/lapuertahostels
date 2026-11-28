import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ImageManifest } from "@lapuertahostels/payload-types";
import { Image } from "./image";
import {
  MediaImage,
  getFocalPropsFromMedia,
  getDisplayDimensionsFromMedia,
} from "./media";
import { media } from "./cms-data.builders";
import { SlideImage } from "~/blocks/slides-block/slide-image";
vi.mock("./environment", () => ({
  useEnvironment: () => ({
    mediaBaseUrl: "https://images.example.com",
    useImageCacheBuster: false,
  }),
}));
export const manifest: ImageManifest = {
  recipeVersion: 1,
  sourceHash: "a".repeat(64),
  focalX: 90,
  focalY: 10,
  variants: [400, 800, 1200].flatMap((width) =>
    ["square", "landscape", "natural", "preview"].map((preset) => ({
      preset,
      key: `optimized/${preset}-${width}.webp`,
      width,
      height: preset === "landscape" ? (width * 3) / 4 : width,
      mimeType: "image/webp" as const,
      focalX: 80,
      focalY: 10,
      sha256: "b".repeat(64),
    })),
  ),
};
const photo = {
  ...media("subject.jpg"),
  width: 1600,
  height: 800,
  focalX: 90,
  focalY: 10,
  imageVariants: manifest,
};
test("responsive images use immutable candidates and actual dimensions", () => {
  render(
    <MediaImage
      media={photo}
      layout="responsive"
      transformation={{ width: 400, aspectRatio: { width: 1, height: 1 } }}
      sizes="100vw"
    />,
  );
  const image = screen.getByRole("img");
  expect(image).toHaveAttribute(
    "src",
    "https://images.example.com/optimized/square-400.webp",
  );
  expect(image.getAttribute("srcset")).toContain("square-1200.webp 1200w");
  expect(image).toHaveAttribute("sizes", "100vw");
  expect(image).toHaveStyle({ objectPosition: "80% 10%" });
});
test("fixed images deduplicate capped candidates and preserve CSS effects", () => {
  render(
    <Image
      src="/subject.jpg"
      variants={manifest}
      layout="fixed"
      transformation={{ width: 800, height: 800, enhancement: "grayscale" }}
    />,
  );
  const image = screen.getByRole("img");
  expect(image.getAttribute("srcset")).toBe(
    "https://images.example.com/optimized/square-400.webp 400w, https://images.example.com/optimized/square-800.webp 800w, https://images.example.com/optimized/square-1200.webp 1200w",
  );
  expect(image).toHaveStyle({ filter: "grayscale(1)" });
});
test("original fallback encodes filenames and retains original focal coordinates", () => {
  render(
    <MediaImage
      media={{
        ...photo,
        filename: "a #photo.jpg",
        _objectKey: "folder",
        imageVariants: undefined,
      }}
      layout="responsive"
    />,
  );
  const image = screen.getByRole("img");
  expect(image.getAttribute("src")).toContain(
    "https://images.example.com/folder/a%20%23photo.jpg?v=",
  );
  expect(image).not.toHaveAttribute("srcset");
  expect(image).toHaveStyle({ objectPosition: "90% 10%" });
});
test("legacy hero alignment remains a fallback", () => {
  render(
    <SlideImage
      media={{ ...photo, focalX: undefined, focalY: undefined }}
      alignment="bottom"
    />,
  );
  expect(screen.getByRole("img")).toHaveClass("object-[center_90%]");
  expect(screen.getByRole("img").style.objectPosition).toBe("");
});
test("tiny previews disappear after the full image loads", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
    false,
  );
  const loaded = vi.fn();
  render(<SlideImage media={photo} withPreview onLoadingFinished={loaded} />);
  const images = screen.getAllByRole("img");
  expect(images[0].getAttribute("src")).toContain("/preview-");
  fireEvent.load(images[1]);
  expect(loaded).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("img")).toHaveLength(1);
});
test("zero coordinates, oriented dimensions, and unresolved placeholders", () => {
  expect(
    getFocalPropsFromMedia({ ...photo, focalX: 0, focalY: 100 }),
  ).toMatchObject({ focalPoint: { x: 0, y: 100 } });
  expect(
    getDisplayDimensionsFromMedia({
      ...photo,
      displayWidth: 800,
      displayHeight: 1600,
    }),
  ).toEqual({ width: 800, height: 1600 });
  const { container } = render(
    <MediaImage media="unpopulated-id" layout="fixed" />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});
