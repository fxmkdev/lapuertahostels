import type { FieldHook, JsonObject, PayloadRequest } from "payload";

function overlayHeading(value: unknown): unknown {
  return value && typeof value === "object" && "heading" in value
    ? value.heading
    : undefined;
}

function legacyHeadingInLocale(source: JsonObject, locale: string) {
  const candidates = [
    ...(Array.isArray(source.locations)
      ? source.locations.map((row) => overlayHeading(row?.overlayTextBox))
      : []),
    overlayHeading(source.overlayTextBox),
  ];
  for (const candidate of candidates) {
    const value =
      candidate && typeof candidate === "object" && locale in candidate
        ? (candidate as Record<string, unknown>)[locale]
        : candidate;
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function legacyHeadingLocales(source: JsonObject, req: PayloadRequest) {
  const localization = req.payload.config.localization;
  const locales = localization ? localization.localeCodes : ["en"];
  const values = Object.fromEntries(
    locales.flatMap((locale) => {
      const heading = legacyHeadingInLocale(source, locale);
      return heading === undefined ? [] : [[locale, heading]];
    }),
  );
  return Object.keys(values).length ? values : undefined;
}

function legacyHeading(source: JsonObject, req: PayloadRequest) {
  if (req.locale === "all") return legacyHeadingLocales(source, req);
  const fallback = req.fallbackLocale;
  const locales = [
    req.locale || "en",
    ...(Array.isArray(fallback) ? fallback : fallback ? [fallback] : []),
  ];
  for (const locale of locales) {
    const heading = legacyHeadingInLocale(source, locale);
    if (heading !== undefined) return heading;
  }
  return undefined;
}

// Run on the nonlocalized locations field: sibling legacy headings still contain
// their locale maps here, before Payload traverses and flattens those children.
export const readMapHeading: FieldHook = ({ value, siblingData, req }) => {
  if (siblingData.heading === undefined) {
    siblingData.heading = legacyHeading(siblingData, req);
  }
  return value;
};

export const writeMapHeading: FieldHook = (args) => {
  if (args.value !== undefined) return args.value;
  return (
    legacyHeading(args.siblingData, args.req) ??
    legacyHeading(args.previousSiblingDoc ?? {}, args.req)
  );
};

// Seed Payload's original locale values so saving or clearing one translation
// does not discard the legacy heading's translations in other locales.
export const preserveMapHeadingLocales: FieldHook = (args) => {
  const original = args.siblingDocWithLocales;
  if (original && original.heading === undefined) {
    original.heading = legacyHeadingLocales(original, args.req);
  }
  return args.value;
};
