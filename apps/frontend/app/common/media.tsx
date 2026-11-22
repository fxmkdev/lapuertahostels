import type { Media } from "@lapuertahostels/payload-types";
import type { ImageProps } from "./image";
import { Image } from "./image";
import { isValidFocalPoint } from "./image-focal-point";
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

export function getFocalPropsFromMedia(
  media: Media | string | undefined | null,
) {
  if (
    !isObject(media) ||
    !media.mimeType?.startsWith("image/") ||
    !media.width ||
    !media.height ||
    media.width <= 0 ||
    media.height <= 0 ||
    !Number.isFinite(media.width) ||
    !Number.isFinite(media.height)
  )
    return {};
  const focalPoint = { x: media.focalX!, y: media.focalY! };
  if (!isValidFocalPoint(focalPoint)) return {};
  return { focalPoint, sourceAspectRatio: media.width / media.height };
}

export type MediaImageProps = Omit<
  ImageProps,
  "src" | "alt" | "focalPoint" | "sourceAspectRatio"
> & {
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
