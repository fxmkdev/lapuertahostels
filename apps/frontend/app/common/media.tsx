import {
  readImageManifest,
  publicMediaUrl,
} from "@lapuertahostels/payload-types";
import type { Media } from "@lapuertahostels/payload-types";
import type { ImageProps } from "./image";
import { Image } from "./image";
import { isValidFocalPoint } from "./image-focal-point";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useLayoutEffect } from "react";
import { gracefully, isObject } from "./utils";

export function getSrcFromMedia(media: Media | string | undefined | null) {
  const filename = gracefully(media, "filename");
  if (!filename) return "";
  const key = [gracefully(media, "_objectKey"), filename]
    .filter(Boolean)
    .join("/");
  return `/${key}`;
}

export function getAltFromMedia(media: Media | string | undefined | null) {
  return gracefully(media, "alt") || "";
}

export function getDisplayDimensionsFromMedia(
  media: Media | string | undefined | null,
) {
  if (!isObject(media)) return undefined;
  const valid = (width: unknown, height: unknown) =>
    typeof width === "number" &&
    typeof height === "number" &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0;
  if (valid(media.displayWidth, media.displayHeight))
    return { width: media.displayWidth!, height: media.displayHeight! };
  if (valid(media.width, media.height))
    return { width: media.width!, height: media.height! };
  return undefined;
}

export function getFocalPropsFromMedia(
  media: Media | string | undefined | null,
) {
  const dimensions = getDisplayDimensionsFromMedia(media);
  if (!isObject(media) || !media.mimeType?.startsWith("image/") || !dimensions)
    return {};
  const focalPoint = { x: media.focalX!, y: media.focalY! };
  if (!isValidFocalPoint(focalPoint)) return {};
  return {
    focalPoint,
  };
}

export type MediaImageProps = Omit<ImageProps, "src" | "alt" | "focalPoint"> & {
  media?: string | Media; // matching generated Payload type to make usage simpler – check at runtime
};

export function MediaImage({
  media,
  className,
  onLoadingFinished,
  ...props
}: MediaImageProps) {
  if (!isObject(media)) {
    return (
      <span className={className}>
        <MediaPlaceholder onLoadingFinished={onLoadingFinished} />
      </span>
    );
  }
  return (
    <Image
      className={className}
      src={getSrcFromMedia(media)}
      variants={readImageManifest(media.imageVariants)}
      originalVersion={media.updatedAt}
      alt={getAltFromMedia(media)}
      onLoadingFinished={onLoadingFinished}
      {...props}
      {...getFocalPropsFromMedia(media)}
    />
  );
}

export function MediaPlaceholder({
  onLoadingFinished,
}: {
  onLoadingFinished?: () => void;
}) {
  useLayoutEffect(() => {
    onLoadingFinished?.();
  }, [onLoadingFinished]);
  return (
    <PhotoIcon className="h-full w-full bg-neutral-100 text-neutral-300" />
  );
}

export function getSocialImage(
  media: Media,
  baseUrl: string,
  preset: "opengraph" | "twitter",
  useDerivatives = true,
) {
  const variant = useDerivatives
    ? readImageManifest(media.imageVariants)?.variants.find(
        (v) => v.preset === preset,
      )
    : undefined;
  const dimensions = getDisplayDimensionsFromMedia(media);
  return {
    url: publicMediaUrl(
      baseUrl,
      variant?.key ?? getSrcFromMedia(media).replace(/^\//, ""),
    ),
    width: variant?.width ?? dimensions?.width,
    height: variant?.height ?? dimensions?.height,
    mimeType: variant?.mimeType ?? media.mimeType,
  };
}
