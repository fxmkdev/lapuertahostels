import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ThemeProvider } from "~/themes";
import { Image } from "./image";
import { MediaImage, getFocalPropsFromMedia } from "./media";
import { media } from "./cms-data.builders";
import { SlideImage } from "~/blocks/slides-block/slide-image";
import { RoomCard } from "~/blocks/room-list-block/room-card";

vi.mock("./environment", () => ({
  useEnvironment: () => ({
    imagekitBaseUrl: "https://images.example.com",
    useImageCacheBuster: false,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => [(key: string) => key],
}));

afterEach(() => vi.restoreAllMocks());

const photo = {
  ...media("subject.jpg", "Off-center subject"),
  width: 1600,
  height: 800,
  focalX: 90,
  focalY: 10,
};

test("scales crop coordinates for every fixed DPR candidate", () => {
  render(
    <Image
      src="/subject.jpg"
      alt="Subject"
      layout="fixed"
      transformation={{ width: 400, height: 400, focus: "auto", blur: 20 }}
      focalPoint={{ x: 90, y: 10 }}
      sourceAspectRatio={2}
    />,
  );
  const image = screen.getByRole("img");
  expect(image.getAttribute("srcset")).toBe(
    [
      "https://images.example.com/tr:w-400,h-400,bl-20,xc-600,yc-200/subject.jpg",
      "https://images.example.com/tr:w-800,h-800,bl-20,xc-1200,yc-400/subject.jpg 2x",
      "https://images.example.com/tr:w-1200,h-1200,bl-20,xc-1800,yc-600/subject.jpg 3x",
    ].join(", "),
  );
  expect(image).toHaveStyle({ objectPosition: "80% 10%" });
});

test("populated media carries focal data to responsive candidates", () => {
  render(
    <MediaImage
      media={photo}
      layout="responsive"
      transformation={{
        width: 400,
        aspectRatio: { width: 1, height: 1 },
        focus: "custom",
      }}
      sizes="100vw"
    />,
  );
  const image = screen.getByRole("img");
  expect(image.getAttribute("srcset")).toContain(
    "xc-600,yc-200/subject.jpg 400w",
  );
  expect(image.getAttribute("srcset")).toContain(
    "xc-1800,yc-600/subject.jpg 1200w",
  );
  expect(image.getAttribute("srcset")).not.toContain("fo-custom");
  expect(image).toHaveAttribute("sizes", "100vw");
  expect(image).toHaveStyle({ objectPosition: "80% 10%" });
});

test.each([
  undefined,
  "unpopulated-id",
  { ...photo, focalX: null },
  { ...photo, focalY: undefined },
  { ...photo, width: 0 },
  { ...photo, height: Infinity },
  { ...photo, mimeType: "video/mp4" },
])("ignores missing or invalid media metadata: %j", (value) => {
  expect(getFocalPropsFromMedia(value)).toEqual({});
});

test("accepts zero coordinates and preserves placeholders", () => {
  expect(getFocalPropsFromMedia({ ...photo, focalX: 0, focalY: 0 })).toEqual({
    focalPoint: { x: 0, y: 0 },
    sourceAspectRatio: 2,
  });
  const { container } = render(
    <MediaImage media="unpopulated-id" layout="fixed" />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});

test("legacy hero alignment and ImageKit URLs remain unchanged", () => {
  render(
    <SlideImage
      media={{ ...photo, focalX: undefined, focalY: undefined }}
      alignment="bottom"
    />,
  );
  const image = screen.getByRole("img");
  expect(image).toHaveClass("object-[center_90%]");
  expect(image.style.objectPosition).toBe("");
  expect(image.getAttribute("srcset")).toContain(
    "tr:ar-4-3,w-800/subject.jpg 800w",
  );
});

test("hero previews and full images share focal positioning and loading behavior", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
    false,
  );
  const onLoadingFinished = vi.fn();
  render(
    <SlideImage
      media={photo}
      alignment="bottom"
      withPreview
      onLoadingFinished={onLoadingFinished}
    />,
  );
  const images = screen.getAllByRole("img");
  expect(images).toHaveLength(2);
  for (const image of images)
    expect(image.style.objectPosition).toBe("85% 10%");
  expect(images[0].getAttribute("srcset")).toContain("bl-20,xc-800,yc-300");
  fireEvent.load(images[1]);
  expect(onLoadingFinished).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("img")).toHaveLength(1);
});

test("room-gallery thumbnails retain media focal metadata", () => {
  render(
    <ThemeProvider themeColor="puerta">
      <RoomCard
        heading="Room"
        images={[
          { image: photo },
          { image: { ...photo, filename: "second.jpg" } },
        ]}
      />
    </ThemeProvider>,
  );
  const images = screen.getAllByRole("img");
  expect(images[0].getAttribute("srcset")).toContain("xc-");
  expect(images[1].getAttribute("srcset")).toContain("xc-");
  expect(images[0].style.objectPosition).not.toBe("");
});
