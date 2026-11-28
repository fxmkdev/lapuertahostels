import { expect, test } from "vitest";
import type { FieldHook } from "payload";
import { readMapHeading, writeMapHeading } from "./heading";

function args(
  source: Record<string, unknown>,
  locale = "en",
  value: unknown = undefined,
) {
  return {
    value,
    siblingData: source,
    req: {
      locale,
      fallbackLocale: "en",
      payload: { config: { localization: { localeCodes: ["en", "es"] } } },
    },
  } as unknown as Parameters<FieldHook>[0];
}
const source = () => ({
  locations: [
    { overlayTextBox: { heading: { en: "  ", es: " " } } },
    { overlayTextBox: { heading: { en: "Visit us", es: "Visítanos" } } },
    { overlayTextBox: { heading: { en: "Other heading", es: "Otro título" } } },
  ],
  overlayTextBox: { heading: { en: "Legacy", es: "Anterior" } },
});

test.each(["en", "es", "all"])(
  "promotes the first nonblank location heading in %s",
  (locale) => {
    const data: Record<string, unknown> = source();
    readMapHeading(args(data, locale));
    expect(data.heading).toEqual(
      locale === "all"
        ? { en: "Visit us", es: "Visítanos" }
        : locale === "en"
          ? "Visit us"
          : "Visítanos",
    );
  },
);

test("falls back to the single-location heading and normalizes legacy writes", () => {
  const data = { overlayTextBox: source().overlayTextBox };
  expect(writeMapHeading(args(data))).toBe("Legacy");
  expect(writeMapHeading(args(data, "es"))).toBe("Anterior");
});

test.each([null, "", "   ", "Shared heading"])(
  "preserves an explicitly set heading: %s",
  (heading) => {
    const data = { ...source(), heading };
    readMapHeading(args(data));
    expect(data.heading).toBe(heading);
    expect(writeMapHeading(args(data, "en", heading))).toBe(heading);
  },
);

test("does not invent a heading for new content", () => {
  const data: Record<string, unknown> = {
    locations: [{ address: "Santa Marta" }],
  };
  readMapHeading(args(data));
  expect(data.heading).toBeUndefined();
  expect(writeMapHeading(args(data))).toBeUndefined();
});
