import type {
  CollectionSlug,
  Field,
  GlobalSlug,
  PayloadRequest,
  TypedLocale,
} from "payload";

const TRANSLATION_LABEL_COMPONENT =
  "/src/components/rsc#TranslationsFieldLabel";

const UNSAFE_FIELD_PATH_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export type TranslationTarget = {
  collection?: CollectionSlug;
  fieldPath: string;
  global?: GlobalSlug;
  id?: string;
};

export function getTranslationTarget(
  req: PayloadRequest,
): Response | TranslationTarget {
  const collection = req.searchParams.get("collection");
  const global = req.searchParams.get("global");
  const id = req.searchParams.get("id");
  const fieldPath = req.searchParams.get("fieldPath");

  if ((collection ? 1 : 0) + (global ? 1 : 0) !== 1) {
    return badRequest("Exactly one of 'collection' or 'global' is required");
  }

  if (collection && !id) {
    return badRequest("'id' is required for collections");
  }

  if (!fieldPath) {
    return badRequest("'fieldPath' is required");
  }

  if (!isSafeFieldPath(fieldPath)) {
    return badRequest("'fieldPath' is invalid");
  }

  if (collection) {
    const collectionConfig = req.payload.config.collections.find(
      (c) => c.slug === collection,
    );

    if (
      !collectionConfig ||
      !isTranslationToolFieldPath(collectionConfig.fields, fieldPath)
    ) {
      return badRequest("Invalid collection or field path");
    }

    return {
      collection: collection as CollectionSlug,
      fieldPath,
      id: id!,
    };
  }

  const globalConfig = req.payload.config.globals?.find(
    (g) => g.slug === global,
  );

  if (
    !globalConfig ||
    !isTranslationToolFieldPath(globalConfig.fields, fieldPath)
  ) {
    return badRequest("Invalid global or field path");
  }

  return {
    fieldPath,
    global: global as GlobalSlug,
  };
}

export function parseTargetLocaleCodes({
  availableTranslationLocales,
  body,
}: {
  availableTranslationLocales: string[];
  body: unknown;
}): Response | TypedLocale[] {
  if (!isRecord(body) || !Array.isArray(body.targetLocaleCodes)) {
    return badRequest("'targetLocaleCodes' must be an array");
  }

  const targetLocaleCodes = body.targetLocaleCodes;
  if (!targetLocaleCodes.every((locale) => typeof locale === "string")) {
    return badRequest("'targetLocaleCodes' must contain only strings");
  }

  const availableLocales = new Set(availableTranslationLocales);
  if (targetLocaleCodes.some((locale) => !availableLocales.has(locale))) {
    return badRequest("Invalid target locales");
  }

  return [...new Set(targetLocaleCodes)] as TypedLocale[];
}

export function isResponse(
  value: Response | TranslationTarget | TypedLocale[],
): value is Response {
  return value instanceof Response;
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ message }), {
    headers: {
      "content-type": "application/json",
    },
    status: 400,
    statusText: "Bad Request",
  });
}

function isSafeFieldPath(fieldPath: string) {
  return fieldPath
    .split(".")
    .every(
      (segment) =>
        segment &&
        !segment.startsWith("$") &&
        !UNSAFE_FIELD_PATH_SEGMENTS.has(segment),
    );
}

function isTranslationToolFieldPath(fields: Field[], fieldPath: string) {
  return fieldsContainTranslationToolPath(fields, fieldPath.split("."));
}

function fieldsContainTranslationToolPath(
  fields: Field[],
  segments: string[],
): boolean {
  return fields.some((field) =>
    fieldMatchesTranslationToolPath(field, segments),
  );
}

function fieldMatchesTranslationToolPath(
  field: Field,
  segments: string[],
): boolean {
  if (segments.length === 0) {
    return false;
  }

  if (hasTabs(field)) {
    return field.tabs.some((tab) => {
      if (tab.name) {
        return (
          segments[0] === tab.name &&
          fieldsContainTranslationToolPath(tab.fields, segments.slice(1))
        );
      }

      return fieldsContainTranslationToolPath(tab.fields, segments);
    });
  }

  if (hasNestedFields(field) && !hasName(field)) {
    return fieldsContainTranslationToolPath(field.fields, segments);
  }

  if (!hasName(field) || segments[0] !== field.name) {
    return false;
  }

  if (segments.length === 1) {
    return hasTranslationLabelComponent(field);
  }

  if (hasArrayFields(field)) {
    return fieldsContainTranslationToolPath(
      field.fields,
      stripRowIndex(segments.slice(1)),
    );
  }

  if (hasBlockFields(field)) {
    const nestedSegments = stripRowIndex(segments.slice(1));

    return field.blocks.some((block) => {
      if (fieldsContainTranslationToolPath(block.fields, nestedSegments)) {
        return true;
      }

      return (
        nestedSegments[0] === block.slug &&
        fieldsContainTranslationToolPath(block.fields, nestedSegments.slice(1))
      );
    });
  }

  if (hasNestedFields(field)) {
    return fieldsContainTranslationToolPath(field.fields, segments.slice(1));
  }

  return false;
}

function stripRowIndex(segments: string[]) {
  return /^\d+$/.test(segments[0] ?? "") ? segments.slice(1) : segments;
}

function hasTranslationLabelComponent(field: Field) {
  const fieldRecord = toRecord(field);
  const components = toRecord(fieldRecord?.admin)?.components;
  const label = toRecord(components)?.Label;

  if (label === TRANSLATION_LABEL_COMPONENT) {
    return true;
  }

  const labelConfig = toRecord(label);
  return (
    labelConfig?.path === "/src/components/rsc" &&
    labelConfig.exportName === "TranslationsFieldLabel"
  );
}

function hasName(field: Field): field is Field & { name: string } {
  return typeof toRecord(field)?.name === "string";
}

function hasNestedFields(field: Field): field is Field & { fields: Field[] } {
  return Array.isArray(toRecord(field)?.fields);
}

function hasArrayFields(field: Field): field is Field & { fields: Field[] } {
  return toRecord(field)?.type === "array" && hasNestedFields(field);
}

function hasBlockFields(
  field: Field,
): field is Field & { blocks: { fields: Field[]; slug: string }[] } {
  const fieldRecord = toRecord(field);
  return fieldRecord?.type === "blocks" && Array.isArray(fieldRecord.blocks);
}

function hasTabs(
  field: Field,
): field is Field & { tabs: { fields: Field[]; name?: string }[] } {
  const fieldRecord = toRecord(field);
  return fieldRecord?.type === "tabs" && Array.isArray(fieldRecord.tabs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}
