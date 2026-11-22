import type { ImageTransformation } from "./image";

/** Payload coordinates are percentages of the original image. */
export type FocalPoint = { x: number; y: number };

export function isValidFocalPoint(
  point: FocalPoint | undefined,
): point is FocalPoint {
  return (
    !!point &&
    [point.x, point.y].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 100,
    )
  );
}

/** Resolve both ImageKit's crop and the point's position in its output. */
export function resolveFocalCrop(
  transformation: ImageTransformation | undefined,
  focalPoint: FocalPoint | undefined,
  sourceAspectRatio: number | undefined,
): {
  transformation: ImageTransformation | undefined;
  objectPosition?: string;
} {
  if (
    !isValidFocalPoint(focalPoint) ||
    !sourceAspectRatio ||
    !Number.isFinite(sourceAspectRatio) ||
    sourceAspectRatio <= 0
  ) {
    return { transformation };
  }

  const aspectRatio = transformation?.aspectRatio;
  const targetRatio = aspectRatio
    ? aspectRatio.width / aspectRatio.height
    : undefined;
  const width =
    transformation?.width ??
    (targetRatio && transformation?.height
      ? transformation.height * targetRatio
      : undefined);
  const height =
    transformation?.height ??
    (targetRatio && width ? width / targetRatio : undefined);
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      transformation,
      objectPosition: `${focalPoint.x}% ${focalPoint.y}%`,
    };
  }

  // ImageKit applies xc/yc after scaling to cover the requested dimensions.
  // https://imagekit.io/docs/image-resize-and-crop#cropping-using-coordinates-maintain-ratio
  const scaledWidth = Math.max(width, height * sourceAspectRatio);
  const scaledHeight = Math.max(height, width / sourceAspectRatio);
  const x = (scaledWidth * focalPoint.x) / 100;
  const y = (scaledHeight * focalPoint.y) / 100;
  const left = Math.min(Math.max(x - width / 2, 0), scaledWidth - width);
  const top = Math.min(Math.max(y - height / 2, 0), scaledHeight - height);

  return {
    transformation: {
      ...transformation,
      focus: undefined,
      centerX: Math.round(left + width / 2),
      centerY: Math.round(top + height / 2),
    },
    // CSS may crop ImageKit's output again. Use the point in that output,
    // rather than applying the original percentages to a different image.
    objectPosition: `${((x - left) / width) * 100}% ${((y - top) / height) * 100}%`,
  };
}
