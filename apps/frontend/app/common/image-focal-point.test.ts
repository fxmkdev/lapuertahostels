import { describe, expect, test } from "vitest";
import { isValidFocalPoint, resolveFocalCrop } from "./image-focal-point";

const square = { width: 400, height: 400, focus: "auto" as const };

describe("focal crop geometry", () => {
  test.each([
    [2, { x: 50, y: 50 }, 400, 200, "50% 50%"],
    [2, { x: 75, y: 25 }, 600, 200, "50% 25%"],
    [0.5, { x: 25, y: 75 }, 200, 600, "25% 50%"],
    [2, { x: 0, y: 100 }, 200, 200, "0% 100%"],
    [2, { x: 100, y: 0 }, 600, 200, "100% 0%"],
  ])(
    "frames source ratio %s around %j",
    (ratio, point, centerX, centerY, objectPosition) => {
      const crop = resolveFocalCrop(square, point, ratio);
      expect(crop.transformation).toEqual({
        ...square,
        focus: undefined,
        centerX,
        centerY,
      });
      expect(crop.objectPosition).toBe(objectPosition);
    },
  );

  test("derives height from an aspect ratio without dropping effects", () => {
    const transformation = {
      width: 400,
      aspectRatio: { width: 1, height: 1 },
      blur: 20,
      enhancement: "grayscale" as const,
      focus: "custom" as const,
    };
    expect(
      resolveFocalCrop(transformation, { x: 75, y: 50 }, 2).transformation,
    ).toEqual({
      ...transformation,
      focus: undefined,
      centerX: 600,
      centerY: 200,
    });
    expect(
      resolveFocalCrop(
        { height: 400, aspectRatio: { width: 1, height: 1 } },
        { x: 75, y: 50 },
        2,
      ).transformation?.centerX,
    ).toBe(600);
  });

  test("width-only resizing preserves the original CSS position", () => {
    expect(resolveFocalCrop({ width: 400 }, { x: 75, y: 25 }, 2)).toEqual({
      transformation: { width: 400 },
      objectPosition: "75% 25%",
    });
    expect(resolveFocalCrop(undefined, { x: 75, y: 25 }, 2)).toEqual({
      transformation: undefined,
      objectPosition: "75% 25%",
    });
  });

  test.each([
    undefined,
    { x: NaN, y: 50 },
    { x: 50, y: Infinity },
    { x: -1, y: 50 },
    { x: 50, y: 101 },
  ])("ignores invalid point %j", (point) => {
    expect(isValidFocalPoint(point)).toBe(false);
    expect(resolveFocalCrop(square, point, 2)).toEqual({
      transformation: square,
    });
  });

  test.each([undefined, 0, -1, Infinity, NaN])(
    "ignores invalid source ratio %s",
    (ratio) => {
      expect(resolveFocalCrop(square, { x: 75, y: 50 }, ratio)).toEqual({
        transformation: square,
      });
    },
  );

  test("keeps the selected point inside a subsequent CSS crop", () => {
    const { objectPosition } = resolveFocalCrop(square, { x: 90, y: 10 }, 2);
    expect(objectPosition).toBe("80% 10%");
    // CSS aligns the same fractional point in the image and its container.
    const [x, y] = objectPosition!
      .split(" ")
      .map(parseFloat)
      .map((value) => value / 100);
    for (const [width, height] of [
      [200, 400],
      [400, 100],
    ]) {
      const scale = Math.max(width / 400, height / 400);
      const visibleX = 400 * scale * x - (400 * scale - width) * x;
      const visibleY = 400 * scale * y - (400 * scale - height) * y;
      expect(visibleX).toBeGreaterThanOrEqual(0);
      expect(visibleX).toBeLessThanOrEqual(width);
      expect(visibleY).toBeGreaterThanOrEqual(0);
      expect(visibleY).toBeLessThanOrEqual(height);
    }
  });
});
