/** Payload coordinates are percentages of the EXIF-oriented original image. */
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
