import { migrateBrandHomeLinksToRootPaths } from "@fxmk/cms-plugin";
import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

type DataRecord = Record<string, unknown>;

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Keep the plugin helper as the migration audit source, but do the write
  // through Mongo: the helper uses Payload updates, which re-run root-path
  // overlap validation and reject the existing "/" root brand while sibling
  // brands like "/aqua" and "/azul" are present.
  const helperResult = await migrateBrandHomeLinksToRootPaths({
    dryRun: true,
    payload,
    req,
  });

  console.log("Brand root path migration helper dry run", helperResult);

  const result = await migrateBrandRootPaths(payload);

  console.log("Migrated brand root paths", result);
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}

async function migrateBrandRootPaths(payload: MigrateUpArgs["payload"]) {
  const brands = payload.db.connection.collection("brands");
  const pages = payload.db.connection.collection("pages");
  const localeIds = getLocaleIds(payload);
  const result = {
    brandsAlreadyMigrated: 0,
    brandsProcessed: 0,
    brandsSkipped: 0,
    brandsUpdated: 0,
    missingHomeLinks: 0,
    missingPages: 0,
  };

  const brandDocuments = (await brands.find({}).toArray()) as DataRecord[];

  for (const brand of brandDocuments) {
    result.brandsProcessed += 1;

    if (isLocalizedRootPath(brand.rootPath)) {
      result.brandsAlreadyMigrated += 1;
      result.brandsSkipped += 1;
      continue;
    }

    const existingRootPath = getRootPathValue(brand.rootPath, localeIds);
    if (existingRootPath) {
      const filter = { _id: brand._id } as Parameters<
        typeof brands.updateOne
      >[0];

      await brands.updateOne(filter, { $set: { rootPath: existingRootPath } });
      result.brandsUpdated += 1;
      continue;
    }

    const homePageId = getHomePageId(brand.homeLink);
    if (!homePageId) {
      result.missingHomeLinks += 1;
      result.brandsSkipped += 1;
      continue;
    }

    const pageFilter = getDocumentIdFilter(homePageId, payload) as Parameters<
      typeof pages.findOne
    >[0];
    const page = (await pages.findOne(pageFilter)) as DataRecord | null;
    if (!page) {
      result.missingPages += 1;
      result.brandsSkipped += 1;
      continue;
    }

    const rootPath = getRootPathValue(page.pathname, localeIds);
    if (!rootPath) {
      result.brandsSkipped += 1;
      continue;
    }

    const filter = { _id: brand._id } as Parameters<typeof brands.updateOne>[0];

    await brands.updateOne(filter, { $set: { rootPath } });
    result.brandsUpdated += 1;
  }

  return result;
}

function getLocaleIds(payload: MigrateUpArgs["payload"]) {
  const localization = payload.config.localization;
  const locales = localization ? localization.locales : [];
  const localeIds = locales.flatMap((locale) => {
    if (typeof locale === "string") {
      return [locale];
    }

    return locale.code ? [locale.code] : [];
  });

  return localeIds.length > 0 ? localeIds : ["en"];
}

function getHomePageId(homeLink: unknown) {
  if (!isRecord(homeLink)) {
    return undefined;
  }

  return getRelationshipId(homeLink.doc);
}

function getRelationshipId(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (isRecord(value) && "value" in value) {
    return getRelationshipId(value.value);
  }

  if (isRecord(value) && ("id" in value || "_id" in value)) {
    return value.id ?? value._id;
  }

  if (value && typeof value === "object") {
    return value;
  }

  return undefined;
}

function getDocumentIdFilter(
  value: unknown,
  payload: MigrateUpArgs["payload"],
) {
  const filters = [{ _id: value }];

  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) {
    filters.push({ _id: new payload.db.connection.base.Types.ObjectId(value) });
  }

  return filters.length === 1 ? filters[0] : { $or: filters };
}

function getRootPathValue(
  value: unknown,
  localeIds: string[],
): DataRecord | undefined {
  if (typeof value === "string") {
    const rootPath = normalizeRootPath(value);

    return rootPath
      ? Object.fromEntries(localeIds.map((localeId) => [localeId, rootPath]))
      : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const rootPath = Object.fromEntries(
    Object.entries(value).flatMap(([localeId, localizedRootPath]) => {
      if (typeof localizedRootPath !== "string") {
        return [];
      }

      const normalizedRootPath = normalizeRootPath(localizedRootPath);

      return normalizedRootPath ? [[localeId, normalizedRootPath]] : [];
    }),
  );

  return Object.keys(rootPath).length > 0 ? rootPath : undefined;
}

function isLocalizedRootPath(value: unknown) {
  return (
    isRecord(value) &&
    Object.values(value).some(
      (localizedRootPath) =>
        typeof localizedRootPath === "string" &&
        Boolean(normalizeRootPath(localizedRootPath)),
    )
  );
}

function normalizeRootPath(value: string) {
  const rootPath = value.trim();

  if (!rootPath.startsWith("/")) {
    return undefined;
  }

  if (rootPath !== "/" && rootPath.endsWith("/")) {
    return undefined;
  }

  return rootPath;
}

function isRecord(value: unknown): value is DataRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
