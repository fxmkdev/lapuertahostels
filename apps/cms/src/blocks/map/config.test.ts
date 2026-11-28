import { expect, test } from "vitest";
import {
  afterReadTraverseFields,
  beforeChangeTraverseFields,
  buildConfig,
  validations,
} from "payload";
import type {
  FieldHook,
  PayloadRequest,
  ArrayField,
  JsonObject,
} from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { MapBlock, readLegacyLocations, writeLegacyLocations } from "./config";

function args(value: unknown, siblingData: Record<string, unknown>) {
  return { value, siblingData } as Parameters<FieldHook>[0];
}
const legacy = {
  id: "000000000000000000000353",
  address: "Santa Marta, Colombia",
  overlayTextBox: {
    heading: "Visit us",
    text: { root: { children: [], type: "root", version: 1 } },
    callToActionLabel: "Directions",
    position: "bottom-right",
  },
};

test("legacy reads and writes expose one editable location without changing the source", () => {
  const result = readLegacyLocations(args(undefined, legacy));
  expect(result).toEqual([legacy]);
  expect(result[0].overlayTextBox).not.toBe(legacy.overlayTextBox);
  expect(writeLegacyLocations(args(undefined, legacy))).toEqual([legacy]);
  expect(readLegacyLocations(args([], legacy))).toEqual([legacy]);
});

test("existing rows take precedence and adding a row retains legacy details", () => {
  const rows = [
    ...readLegacyLocations(args(undefined, legacy)),
    { address: "Bogota" },
  ];
  expect(readLegacyLocations(args(rows, legacy))).toBe(rows);
  expect(writeLegacyLocations(args(rows, legacy))).toBe(rows);
  expect(rows[0]).toEqual(legacy);
  expect(writeLegacyLocations(args([], legacy))).toEqual([]);
});

test("new maps and explicitly emptied maps require at least one location", async () => {
  const field = MapBlock.fields.find(
    (field) => "name" in field && field.name === "locations",
  ) as ArrayField;
  const options = { ...field, req: { t: (key: string) => key } } as Parameters<
    typeof validations.array
  >[1];
  expect(await validations.array(undefined, options)).not.toBe(true);
  expect(await validations.array([], options)).not.toBe(true);
  expect(await validations.array([legacy], options)).toBe(true);
});

test.each(["en", "es", "all"])(
  "Payload reads legacy overlays and independent location names in locale %s",
  async (locale) => {
    const config = await buildConfig({
      secret: "map-test",
      db: mongooseAdapter({ url: "mongodb://127.0.0.1/map-tests" }),
      editor: lexicalEditor(),
      localization: { locales: ["en", "es"], defaultLocale: "en" },
      collections: [
        {
          slug: "pages",
          fields: [{ name: "content", type: "blocks", blocks: [MapBlock] }],
        },
      ],
    });
    const collection = config.collections.find(({ slug }) => slug === "pages")!;
    const localizedOverlay = {
      ...legacy.overlayTextBox,
      heading: { en: "Visit us", es: "Visítanos" },
      text: { en: legacy.overlayTextBox.text, es: legacy.overlayTextBox.text },
      callToActionLabel: { en: "Directions", es: "Indicaciones" },
    };
    const doc: JsonObject = {
      content: [
        {
          blockType: "Map",
          ...legacy,
          overlayTextBox: structuredClone(localizedOverlay),
        },
        {
          blockType: "Map",
          locations: [
            {
              ...legacy,
              name: { en: "Aqua Hostel", es: "Hostal Aqua" },
              overlayTextBox: structuredClone(localizedOverlay),
            },
          ],
        },
      ],
    };
    const fieldPromises: Promise<void>[] = [];
    const populationPromises: Promise<void>[] = [];
    const req = {
      locale,
      fallbackLocale: "en",
      payload: { config },
      context: {},
    } as unknown as PayloadRequest;
    afterReadTraverseFields({
      collection,
      context: {},
      currentDepth: 1,
      depth: 0,
      doc,
      draft: false,
      fallbackLocale: "en",
      fieldPromises,
      fields: collection.fields,
      findMany: false,
      flattenLocales: true,
      global: null,
      locale,
      overrideAccess: true,
      parentIndexPath: "",
      parentPath: "",
      parentSchemaPath: "",
      populationPromises,
      req,
      showHiddenFields: false,
      siblingDoc: doc,
    });
    while (fieldPromises.length || populationPromises.length) {
      await Promise.all(fieldPromises.splice(0));
      await Promise.all(populationPromises.splice(0));
    }
    const block = (doc.content as Record<string, unknown>[])[0];
    expect(block.heading).toEqual(
      locale === "all"
        ? localizedOverlay.heading
        : localizedOverlay.heading[locale as "en" | "es"],
    );
    const locations = block.locations as (typeof legacy)[];
    const namedBlock = (doc.content as Record<string, unknown>[])[1];
    expect(namedBlock.heading).toEqual(
      locale === "all"
        ? localizedOverlay.heading
        : localizedOverlay.heading[locale as "en" | "es"],
    );
    const named = (
      namedBlock.locations as {
        name: unknown;
        overlayTextBox: { heading: unknown };
      }[]
    )[0];
    expect(named.name).toEqual(
      locale === "all"
        ? { en: "Aqua Hostel", es: "Hostal Aqua" }
        : locale === "en"
          ? "Aqua Hostel"
          : "Hostal Aqua",
    );
    expect(named.overlayTextBox.heading).toEqual(
      locale === "all"
        ? localizedOverlay.heading
        : localizedOverlay.heading[locale as "en" | "es"],
    );

    expect(locations[0].address).toBe(legacy.address);
    expect(locations[0].overlayTextBox.text).toEqual(
      locale === "all" ? localizedOverlay.text : legacy.overlayTextBox.text,
    );
    expect(locations[0].overlayTextBox.heading).toEqual(
      locale === "all"
        ? localizedOverlay.heading
        : localizedOverlay.heading[locale as "en" | "es"],
    );
    expect(locations[0].overlayTextBox.callToActionLabel).toEqual(
      locale === "all"
        ? localizedOverlay.callToActionLabel
        : localizedOverlay.callToActionLabel[locale as "en" | "es"],
    );
  },
);

test.each(["Updated shared heading", null, "", "   "])(
  "saving shared heading %s preserves other locales and explicit clears",
  async (heading) => {
    const config = await buildConfig({
      secret: "map-test",
      db: mongooseAdapter({ url: "mongodb://127.0.0.1/map-tests" }),
      editor: lexicalEditor(),
      localization: { locales: ["en", "es"], defaultLocale: "en" },
      collections: [
        {
          slug: "pages",
          fields: [{ name: "content", type: "blocks", blocks: [MapBlock] }],
        },
      ],
    });
    const collection = config.collections.find(({ slug }) => slug === "pages")!;
    const original: JsonObject = {
      content: [
        {
          blockType: "Map",
          ...structuredClone(legacy),
          overlayTextBox: {
            ...structuredClone(legacy.overlayTextBox),
            heading: { en: "Visit us", es: "Visítanos" },
            text: {
              en: legacy.overlayTextBox.text,
              es: legacy.overlayTextBox.text,
            },
            callToActionLabel: { en: "Directions", es: "Indicaciones" },
          },
        },
      ],
    };
    const data: JsonObject = {
      content: [
        {
          blockType: "Map",
          ...structuredClone(legacy),
          zoomLevel: 14,
          heading,
          locations: [
            {
              ...structuredClone(legacy),
              overlayTextBox: {
                ...structuredClone(legacy.overlayTextBox),
                heading: "Updated English",
              },
            },
            {
              ...structuredClone(legacy),
              id: "000000000000000000000354",
              address: "Another place",
            },
          ],
        },
      ],
    };
    const req = {
      locale: "en",
      payload: { config },
      context: {},
      t: (key: string) => key,
      i18n: { language: "en", t: (key: string) => key },
    } as unknown as PayloadRequest;
    const mergeLocaleActions: (() => Promise<void> | void)[] = [];
    await beforeChangeTraverseFields({
      collection,
      context: {},
      data,
      doc: {},
      docWithLocales: original,
      errors: [],
      fieldLabelPath: "",
      fields: collection.fields,
      global: null,
      mergeLocaleActions,
      operation: "update",
      overrideAccess: true,
      parentIndexPath: "",
      parentPath: "",
      parentSchemaPath: "",
      req,
      siblingData: data,
      siblingDoc: {},
      siblingDocWithLocales: original,
      skipValidation: true,
    });
    for (const merge of mergeLocaleActions) await merge();
    const block = (data.content as Record<string, unknown>[])[0];
    expect(block.heading).toEqual({ en: heading, es: "Visítanos" });
    const fieldPromises: Promise<void>[] = [];
    const populationPromises: Promise<void>[] = [];
    const read = structuredClone(data);
    afterReadTraverseFields({
      collection,
      context: {},
      currentDepth: 1,
      depth: 0,
      doc: read,
      draft: false,
      fallbackLocale: "en",
      fieldPromises,
      fields: collection.fields,
      findMany: false,
      flattenLocales: true,
      global: null,
      locale: "en",
      overrideAccess: true,
      parentIndexPath: "",
      parentPath: "",
      parentSchemaPath: "",
      populationPromises,
      req,
      showHiddenFields: false,
      siblingDoc: read,
    });
    while (fieldPromises.length || populationPromises.length) {
      await Promise.all(fieldPromises.splice(0));
      await Promise.all(populationPromises.splice(0));
    }
    expect((read.content as Record<string, unknown>[])[0].heading).toBe(
      heading,
    );
    const rows = block.locations as {
      overlayTextBox: { heading: unknown; callToActionLabel: unknown };
    }[];
    expect(rows[0].overlayTextBox.heading).toEqual({
      en: "Updated English",
      es: "Visítanos",
    });
    expect(rows[0].overlayTextBox.callToActionLabel).toEqual({
      en: "Directions",
      es: "Indicaciones",
    });
  },
);
