import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

type Document = Record<string, unknown>;
type BrandDocument = Document & {
  homeLink?: unknown;
  id?: unknown;
  name?: unknown;
};

const colorOptions = new Set(["puerta", "aqua", "azul"]);

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const brands = await loadBrands(payload);

  await migrateCollection(payload, "pages", "content", brands);

  const collectionNames = await getCollectionNames(payload);
  const pageVersionCollectionNames = collectionNames.filter((name) =>
    ["_pages_versions", "pages_versions"].includes(name),
  );

  for (const collectionName of pageVersionCollectionNames) {
    await migrateCollection(payload, collectionName, "version.content", brands);
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}

async function loadBrands(
  payload: MigrateUpArgs["payload"],
): Promise<Map<string, BrandDocument>> {
  const brands = (await payload.db.connection
    .collection("brands")
    .find({})
    .toArray()) as BrandDocument[];

  return new Map(
    brands.flatMap((brand) =>
      [brand.id, brand._id]
        .filter((id): id is string | number | boolean | object => id != null)
        .map((id) => [String(id), brand]),
    ),
  );
}

async function migrateCollection(
  payload: MigrateUpArgs["payload"],
  collectionName: string,
  contentPath: string,
  brands: Map<string, BrandDocument>,
) {
  const collection = payload.db.connection.collection(collectionName);
  const documents = (await collection.find({}).toArray()) as Document[];

  for (const document of documents) {
    const content = getPath(document, contentPath);
    const { changed, value } = migrateContent(
      content,
      brands,
      `${collectionName}/${String(document._id)}`,
    );

    if (changed) {
      const filter = {
        _id: document._id,
      } as Parameters<typeof collection.updateOne>[0];

      await collection.updateOne(filter, {
        $set: {
          [contentPath]: value,
        },
      });
    }
  }
}

async function getCollectionNames(payload: MigrateUpArgs["payload"]) {
  const db = payload.db.connection.db;

  if (!db) {
    throw new Error("Missing database connection while listing collections");
  }

  const collections = await db.listCollections().toArray();

  return collections.map((collection) => collection.name);
}

function migrateContent(
  content: unknown,
  brands: Map<string, BrandDocument>,
  context: string,
): { changed: boolean; value: unknown } {
  if (Array.isArray(content)) {
    let changed = false;
    const value = content.map((block, blockIndex) => {
      const migrated = migrateBlock(
        block,
        brands,
        `${context}/content[${blockIndex}]`,
      );
      changed ||= migrated.changed;
      return migrated.value;
    });

    return { changed, value };
  }

  if (isRecord(content)) {
    let changed = false;
    const value = Object.fromEntries(
      Object.entries(content).map(([locale, localeContent]) => {
        const migrated = migrateContent(
          localeContent,
          brands,
          `${context}/${locale}`,
        );
        changed ||= migrated.changed;
        return [locale, migrated.value];
      }),
    );

    return { changed, value };
  }

  return { changed: false, value: content };
}

function migrateBlock(
  block: unknown,
  brands: Map<string, BrandDocument>,
  context: string,
): { changed: boolean; value: unknown } {
  if (!isRecord(block) || block.blockType !== "AccommodationSelector") {
    return { changed: false, value: block };
  }

  if (!Array.isArray(block.cards)) {
    return { changed: false, value: block };
  }

  let changed = false;
  const cards = block.cards.map((card, cardIndex) => {
    const migrated = migrateCard(
      card,
      brands,
      `${context}/cards[${cardIndex}]`,
    );
    changed ||= migrated.changed;
    return migrated.value;
  });

  return {
    changed,
    value: changed ? { ...block, cards } : block,
  };
}

function migrateCard(
  card: unknown,
  brands: Map<string, BrandDocument>,
  context: string,
): { changed: boolean; value: unknown } {
  if (!isRecord(card)) {
    return { changed: false, value: card };
  }

  if (!("brand" in card)) {
    return { changed: false, value: card };
  }

  const brand = resolveBrand(card.brand, brands, context);
  const title = getRequiredString(brand.name, `${context} brand name`);
  const color = getRequiredColor(brand.id ?? brand._id, `${context} brand id`);

  if (!isRecord(brand.homeLink)) {
    throw new Error(`Missing brand homeLink for ${context}`);
  }

  const { brand: _brand, ...rest } = card;

  return {
    changed: true,
    value: {
      ...rest,
      title,
      link: brand.homeLink,
      color,
    },
  };
}

function resolveBrand(
  brandReference: unknown,
  brands: Map<string, BrandDocument>,
  context: string,
) {
  const brandId = getRelationshipId(brandReference);
  const brand = brandId ? brands.get(brandId) : undefined;

  if (!brand) {
    throw new Error(
      `Could not resolve accommodation selector brand for ${context}`,
    );
  }

  return brand;
}

function getRelationshipId(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (isRecord(value)) {
    return getRelationshipId(value.value ?? value.id ?? value._id);
  }

  return String(value);
}

function getRequiredString(value: unknown, context: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing ${context}`);
  }

  return value;
}

function getRequiredColor(value: unknown, context: string) {
  const color = getRequiredString(value, context);

  if (!colorOptions.has(color)) {
    throw new Error(`Unsupported ${context}: ${color}`);
  }

  return color;
}

function getPath(document: Document, path: string) {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, document);
}

function isRecord(value: unknown): value is Document {
  return typeof value === "object" && value !== null;
}
