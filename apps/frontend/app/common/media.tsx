import type { Media } from "@lapuertahostels/payload-types";
import type { ImageProps, ImageTransformation } from "./image";
import { Image, toImagekitTransformationString } from "./image";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useLayoutEffect } from "react";
import { gracefully, isObject } from "./utils";

export function getSrcFromMedia(media: Media | string | undefined | null) {
  const filename = gracefully(media, "filename");
  return filename ? `/${encodeURIComponent(filename)}` : "";
}

export function getAltFromMedia(media: Media | string | undefined | null) {
  return gracefully(media, "alt") || "";
}

export function getMediaImageUrl(
  media: Media | string | null | undefined,
  imagekitBaseUrl: string,
  transformation?: ImageTransformation,
) {
  if (
    typeof media !== "object" ||
    !media?.filename?.trim() ||
    !media.mimeType?.startsWith("image/")
  ) {
    return undefined;
  }

  try {
    const baseUrl = new URL(imagekitBaseUrl);
    if (
      !["http:", "https:"].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.search ||
      baseUrl.hash
    ) {
      return undefined;
    }
    const imageTransformation = transformation
      ? `/${toImagekitTransformationString(transformation)}`
      : "";
    return `${baseUrl.href.replace(/\/$/, "")}${imageTransformation}${getSrcFromMedia(media)}`;
  } catch {
    return undefined;
  }
}

export type MediaImageProps = Omit<ImageProps, "src" | "alt"> & {
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
      alt={getAltFromMedia(media)}
      onLoadingFinished={onLoadingFinished}
      {...props}
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
