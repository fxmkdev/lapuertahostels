import { expect, test } from "vitest";
import { isValidFocalPoint } from "./image-focal-point";
test.each([undefined, { x: NaN, y: 0 }, { x: -1, y: 50 }, { x: 50, y: 101 }])(
  "invalid focal point %j",
  (point) => expect(isValidFocalPoint(point)).toBe(false),
);
test.each([
  { x: 0, y: 100 },
  { x: 100, y: 0 },
  { x: 50, y: 50 },
])("valid focal point %j", (point) =>
  expect(isValidFocalPoint(point)).toBe(true),
);
