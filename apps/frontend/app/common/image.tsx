import type { DetailedHTMLProps, ImgHTMLAttributes, Ref } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ImageManifest } from "@lapuertahostels/payload-types";
import { publicMediaUrl } from "@lapuertahostels/payload-types";
import { useEnvironment } from "~/common/environment";
import { mergeRefs } from "./utils";
import { isValidFocalPoint, type FocalPoint } from "./image-focal-point";

export type ImageTransformation = {
  width?: number;
  height?: number;
  aspectRatio?: { width: number; height: number };
  enhancement?: "grayscale";
  blur?: number;
};
export type ImageProps = {
  src: string;
  alt?: string;
  className?: string;
  transformation?: ImageTransformation;
  variants?: ImageManifest;
  originalVersion?: string;
  focalPoint?: FocalPoint;
  onLoadingFinished?: () => void;
  layout: "fixed" | "responsive";
  ref?: Ref<HTMLImageElement>;
} & Pick<
  DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>,
  "loading" | "sizes" | "style"
>;

export function selectImageVariants(
  manifest?: ImageManifest,
  transformation?: ImageTransformation,
) {
  const ratio = transformation?.aspectRatio
    ? transformation.aspectRatio.width / transformation.aspectRatio.height
    : transformation?.width && transformation.height
      ? transformation.width / transformation.height
      : undefined;
  const profile = transformation?.blur
    ? "preview"
    : ratio === 1
      ? "square"
      : ratio === 4 / 3
        ? "landscape"
        : ratio === 3 / 4
          ? "portrait"
          : ratio === 9 / 10
            ? "column"
            : "natural";
  return (
    manifest?.variants
      .filter((v) => v.preset === profile)
      .sort((a, b) => a.width - b.width) ?? []
  );
}

export function Image({
  src,
  alt,
  layout = "responsive",
  className,
  transformation,
  variants,
  originalVersion,
  focalPoint,
  onLoadingFinished,
  ref,
  style,
  ...props
}: ImageProps) {
  const { mediaBaseUrl, mediaUseDerivatives, useImageCacheBuster } =
    useEnvironment();
  const localRef = useRef<HTMLImageElement>(null);
  const cacheBusterId = useId();
  const [isLoading, setIsLoading] = useState(true);
  const onLoad = useCallback(() => {
    setIsLoading(false);
    onLoadingFinished?.();
  }, [onLoadingFinished]);
  useEffect(() => {
    if (isLoading && localRef.current?.complete) onLoad();
  }, [isLoading, onLoad]);
  function url(key: string) {
    const value = new URL(
      /^https?:\/\//.test(key)
        ? key
        : publicMediaUrl(mediaBaseUrl, key.replace(/^\//, "")),
    );
    if (useImageCacheBuster)
      value.searchParams.set("cacheBuster", cacheBusterId);
    return value.toString();
  }
  const candidates = selectImageVariants(
    mediaUseDerivatives === false ? undefined : variants,
    transformation,
  );
  const requestedWidth =
    transformation?.width ??
    (transformation?.height && candidates[0]
      ? (transformation.height * candidates[0].width) / candidates[0].height
      : 400);
  const chosen =
    candidates.find((v) => v.width >= requestedWidth) ?? candidates.at(-1);
  const srcSet = candidates.length
    ? candidates.map((v) => `${url(v.key)} ${v.width}w`).join(", ")
    : undefined;
  const point = isValidFocalPoint(focalPoint)
    ? chosen
      ? { x: chosen.focalX, y: chosen.focalY }
      : focalPoint
    : undefined;
  const filters =
    [
      style?.filter,
      transformation?.enhancement === "grayscale" ? "grayscale(1)" : undefined,
      transformation?.blur ? `blur(${transformation.blur}px)` : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const sourceUrl = new URL(url(chosen?.key ?? src));
  if (!chosen && originalVersion)
    sourceUrl.searchParams.set("v", originalVersion);
  return (
    <img
      {...props}
      src={sourceUrl.toString()}
      srcSet={srcSet}
      sizes={
        props.sizes ?? (layout === "fixed" ? `${requestedWidth}px` : undefined)
      }
      className={className}
      style={{
        ...style,
        ...(point ? { objectPosition: `${point.x}% ${point.y}%` } : {}),
        ...(filters ? { filter: filters } : {}),
      }}
      alt={alt}
      ref={mergeRefs(ref, localRef)}
      onLoad={onLoad}
    />
  );
}
