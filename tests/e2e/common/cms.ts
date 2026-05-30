import { createId } from "@paralleldrive/cuid2";
import fs from "fs/promises";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import {
  Brand,
  LocaleConfig,
  Media,
  Page,
  Settings,
} from "@lapuertahostels/payload-types";

type BrandSeedDocument = {
  _id: string;
  createdAt: string;
  footer: { linkGroups: [] };
  id: string;
  logo: ObjectId;
  name: string;
  rootPath: Localized<string>;
  updatedAt: string;
};

type Localized<T> = {
  en: T;
  es: T;
};

type PageSeedDocument = Omit<
  Partial<Page>,
  "createdAt" | "id" | "pathname" | "title" | "updatedAt"
> & {
  _id: ObjectId;
  createdAt: string;
  pathname: Localized<string>;
  title: Localized<string>;
  updatedAt: string;
};

export async function createPage(data: Partial<Page> = {}) {
  const testPagePathname = `/e2e/${createId()}`;
  const now = new Date().toISOString();
  const pageId = new ObjectId();
  const title = data.title ?? "Default Title";

  data = {
    ...data,
    pathname: testPagePathname,
    brand: "puerta",
    title,
    hero: withArrayRowIds(data.hero),
    content: withArrayRowIds(data.content),
  };

  await withCmsDatabase(async (client) => {
    const database = client.db();

    const { id: _, pathname: __, title: ___, ...documentData } = data;
    // The page block arrays are not localized fields in the CMS schema.
    // Only nested localized values, such as rich text, need locale wrappers.
    const localizedDocumentData = castMediaRelationshipIds(
      localizeRichTextFields(documentData),
    ) as Omit<
      PageSeedDocument,
      "_id" | "createdAt" | "pathname" | "title" | "updatedAt"
    >;

    await database.collection<PageSeedDocument>("pages").insertOne({
      _id: pageId,
      ...localizedDocumentData,
      createdAt: now,
      pathname: {
        en: testPagePathname,
        es: testPagePathname,
      },
      title: {
        en: title,
        es: title,
      },
      updatedAt: now,
    });
  });

  return {
    ...data,
    createdAt: now,
    id: pageId.toHexString(),
    pathname: testPagePathname,
    title,
    updatedAt: now,
  } as Page;
}

export async function getPuertaBrand() {
  return (await get("brands/puerta")) as Brand;
}

export async function getMedia(filename: string) {
  const result = await get(
    `media?where[filename][equals]=${encodeURIComponent(filename)}&pagination=false&limit=1`,
  );
  if (!result.docs) return null;

  return result.docs[0] as Media;
}

export async function createPuertaBrand() {
  const media = await getOrCreateMedia("logo-puerta-simple.png", "image/png");
  const now = new Date().toISOString();

  await withCmsDatabase(async (client) => {
    const database = client.db();

    await database.collection<BrandSeedDocument>("brands").updateOne(
      { _id: "puerta" },
      {
        $setOnInsert: {
          _id: "puerta",
          createdAt: now,
          id: "puerta",
        },
        $set: {
          footer: { linkGroups: [] },
          logo: toObjectId(media.id),
          name: "La Puerta Hostels",
          rootPath: localizeForAllLocales("/"),
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  });
}

export async function mockUiLabelTranslations() {
  await updateGlobal(
    "common",
    {
      uiLabels: {
        maintenanceScreen: {
          login: "Login",
        },
        banner: {
          dismiss: "Dismiss",
        },
        login: {
          email: "Email",
          password: "Password",
          submit: "Log In",
        },
        imageViewer: {
          next: "Next",
          seeMoreImages_one: "+{{count}} Photo",
          fullscreen: "Full Screen",
          close: "Close",
          seeMoreImages_other: "+{{count}} Photos",
          previous: "Previous",
          exitFullscreen: "Exit Full Screen",
        },
        slidesBlock: {
          goToSlide: "Go to slide {{slide}}",
        },
        errorBoundary: {
          text: "<p>Oops! Something went wrong.</p><p>This page isn’t working right now. Please try refreshing or come back a bit later.</p><p>Thank you for your understanding!</p>",
          title: "500 – Something went wrong",
        },
        footer: {
          heading: "Footer",
          newsletter: {
            emailLabel: "Email",
          },
        },
      },
    },
    "en",
  );
}

export async function initializeLocale() {
  let englishLocale = (await get("locale-configs/en")) as
    | LocaleConfig
    | undefined;
  if (!englishLocale) {
    await create("locale-configs", {
      locale: "en",
      displayLabel: "English",
      deeplSourceLanguage: "en",
      deeplTargetLanguage: "en-US",
      googleMapsLanguage: "en",
    } as Omit<LocaleConfig, "id" | "createdAt" | "updatedAt">);
  }
  let spanishLocale = (await get("locale-configs/es")) as
    | LocaleConfig
    | undefined;
  if (!spanishLocale) {
    await create("locale-configs", {
      locale: "es",
      displayLabel: "Español",
      deeplSourceLanguage: "es",
      deeplTargetLanguage: "es-419",
      googleMapsLanguage: "es-419",
    } as Omit<LocaleConfig, "id" | "createdAt" | "updatedAt">);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await updateGlobal("settings", {
    publishedLocales: {
      publishedLocales: ["en", "es"],
      fallbackLocale: "en",
    },
    maps: {
      mapId: "mock-map-id",
    },
  } as Settings);
}

export async function create(collection: string, content: object) {
  const result = await fetchCms(collection, {
    method: "POST",
    body: JSON.stringify(content),
  });

  return result.doc;
}

export async function updateGlobal(
  globalType: string,
  content: object,
  locale?: string,
) {
  const result = await fetchCms(
    `globals/${globalType}${locale ? `?locale=${locale}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify(content),
    },
  );

  return result.doc;
}

export async function getOrCreateMedia(
  filename: string,
  mimeType: string,
  alt?: string,
) {
  const media = await getMedia(filename);
  if (media) return media;

  return await createMedia(filename, mimeType, alt);
}

async function createMedia(filename: string, mimeType: string, alt?: string) {
  const buffer = await fs.readFile(path.join("./assets", filename));
  const file = new File([buffer], filename, { type: mimeType });

  const formData = new FormData();
  formData.append("file", file);

  const additionalFields: Partial<Media> = {};
  additionalFields.alt = alt;

  formData.append("_payload", JSON.stringify(additionalFields));

  return (
    await fetchCms("media", {
      method: "POST",
      body: formData,
    })
  ).doc as Media;
}

export async function get(path: string) {
  return fetchCms(path);
}

async function withCmsDatabase<T>(
  callback: (client: MongoClient) => Promise<T>,
) {
  const client = new MongoClient(getCmsDatabaseUri());

  try {
    await client.connect();

    return await callback(client);
  } finally {
    await client.close();
  }
}

function getCmsDatabaseUri() {
  return (
    process.env.CMS_DATABASE_URI ??
    process.env.DATABASE_URI ??
    "mongodb://localhost:27017/website-cms"
  );
}

function localizeForAllLocales<T>(value: T): Localized<T> {
  return {
    en: value,
    es: value,
  };
}

function withArrayRowIds<T extends { id?: string | null }>(
  rows: T[] | null | undefined,
) {
  return rows?.map((row) => ({ ...row, id: row.id ?? createId() })) ?? rows;
}

function localizeRichTextFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(localizeRichTextFields);
  }

  if (!isRecord(value)) {
    return value;
  }

  if (isLexicalRichText(value)) {
    return localizeForAllLocales(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, childValue]) => [
      key,
      localizeRichTextFields(childValue),
    ]),
  );
}

function castMediaRelationshipIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(castMediaRelationshipIds);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, childValue]) => {
      if (isMediaRelationshipKey(key) && typeof childValue === "string") {
        return [key, toObjectId(childValue)];
      }

      return [key, castMediaRelationshipIds(childValue)];
    }),
  );
}

function isMediaRelationshipKey(key: string) {
  return key === "image" || key === "logo";
}

function toObjectId(value: string) {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Expected a Mongo ObjectId string, got "${value}"`);
  }

  return new ObjectId(value);
}

function isLexicalRichText(value: Record<string, unknown>) {
  return isRecord(value.root);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchCms(path: string, init?: RequestInit) {
  const url = new URL(`/api/${path}`, process.env.CMS_BASE_URL);

  const method = init?.method ?? "GET";

  const headers = new Headers({
    ...init?.headers,
    Authorization: `api-keys API-Key ${process.env.CMS_API_KEY}`,
  });
  if (typeof init?.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const result = await fetch(url, { ...init, method, headers });

  if (!result.ok) {
    if (method === "GET" && result.status === 404) return null;

    console.error(
      `${method} ${path} returned: ${JSON.stringify(await result.json(), null, 2)}`,
    );

    if (method !== "GET") {
      console.debug(
        `request body:`,
        headers.get("Content-Type") === "application/json" && init?.body
          ? JSON.stringify(JSON.parse(init.body as string), null, 2)
          : init?.body,
      );
    }
    throw new Error(`Failed with status code: ${result.status}`);
  }

  return await result.json();
}
