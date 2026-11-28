import type {
  Brand,
  Banner,
  Common,
  Settings,
  Page,
  Redirect,
  Footer,
} from "@lapuertahostels/payload-types";
import { BRANDS_DEPTH, PAGE_DEPTH } from "./cms-data";
import { runRedisCommand } from "./redis";
import { getCmsCachePrefix, invalidateCmsCache } from "./cms-cache.server";

const CACHE_FRESH_IN_MS = 60_000;
const CACHE_MAX_AGE_IN_MS = 300_000;

type CacheEntry<T> = {
  version: 1;
  data: T;
  cachedAt: number;
};

class CmsLoadError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

async function deleteCachedData(key: string) {
  try {
    await runRedisCommand((redis) => redis.del(key));
  } catch (error) {
    console.warn(
      `Failed to delete CMS cache entry ${key}: ${formatError(error)}`,
    );
  }
}

async function getCachedData<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const value = await runRedisCommand((redis) => redis.get(key));
    if (!value) return null;
    const entry = JSON.parse(value) as Partial<CacheEntry<T>> | null;
    if (
      entry?.version === 1 &&
      entry.data != null &&
      typeof entry.cachedAt === "number" &&
      Number.isFinite(entry.cachedAt) &&
      entry.cachedAt <= Date.now() &&
      Date.now() - entry.cachedAt < CACHE_MAX_AGE_IN_MS
    ) {
      return entry as CacheEntry<T>;
    }
  } catch (error) {
    console.warn(
      `Failed to read CMS cache entry ${key}: ${formatError(error)}`,
    );
  }
  await deleteCachedData(key);
  return null;
}

async function cacheResult<T>(key: string, result: T | null, cachedAt: number) {
  if (result === null) {
    await deleteCachedData(key);
  } else {
    const remainingLifetime = CACHE_MAX_AGE_IN_MS - (Date.now() - cachedAt);
    if (remainingLifetime > 0) {
      try {
        await runRedisCommand((redis) =>
          redis.set(
            key,
            JSON.stringify({
              version: 1,
              data: result,
              cachedAt,
            } satisfies CacheEntry<T>),
            { PX: remainingLifetime },
          ),
        );
      } catch (error) {
        console.warn(
          `Failed to write CMS cache entry ${key}: ${formatError(error)}`,
        );
      }
    }
  }
}

async function getData<TData, TResult>(
  req: Request,
  pathname: string,
  cacheKey: string,
  locale: string | null,
  depth = 1,
  queryParams = {},
  getResultFn: (data: TData | null) => TResult | null = (data: TData | null) =>
    data as TResult,
) {
  if (new URL(req.url).searchParams.get("skipcache") === "true") {
    return getResultFn(await loadData(pathname, locale, depth, queryParams));
  }

  // Capture the generation before loading. A save can rotate it while this
  // request is in flight; any late write remains in the old namespace.
  const prefix = await getCmsCachePrefix();
  const key = prefix
    ? `${prefix}:${cacheKey}${locale ? `:${locale}` : ""}`
    : null;
  const entry = key ? await getCachedData<TResult>(key) : null;
  if (entry && Date.now() - entry.cachedAt < CACHE_FRESH_IN_MS)
    return entry.data;

  const cachedAt = Date.now();
  let result: TResult | null;
  try {
    result = getResultFn(await loadData(pathname, locale, depth, queryParams));
  } catch (error) {
    if (
      error instanceof CmsLoadError &&
      error.transient &&
      entry &&
      Date.now() - entry.cachedAt < CACHE_MAX_AGE_IN_MS
    ) {
      console.warn(
        `CMS refresh failed for ${key}; using bounded stale data: ${formatError(error)}`,
      );
      return entry.data;
    }
    if (key && entry) await deleteCachedData(key);
    throw error;
  }

  if (key) await cacheResult(key, result, cachedAt);
  return result;
}

export async function loadData(
  pathname: string,
  locale: string | null,
  depth: number,
  queryParams: Record<string, string>,
) {
  if (!process.env.PAYLOAD_CMS_BASE_URL) {
    throw new Error("PAYLOAD_CMS_BASE_URL is not set");
  }
  if (!process.env.PAYLOAD_CMS_API_KEY) {
    throw new Error("PAYLOAD_CMS_API_KEY is not set");
  }
  const url = new URL(`/api/${pathname}`, process.env.PAYLOAD_CMS_BASE_URL);
  if (locale) {
    url.searchParams.set("locale", locale);
  }
  url.searchParams.set("depth", depth.toString());
  url.searchParams.set("draft", "false");
  url.searchParams.set("pagination", "false");
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  console.log(`Loading data from CMS for ${url.toString()} in ${locale}`);
  return await readCmsResponse(await fetchCmsResponse(url));
}

async function fetchCmsResponse(url: URL) {
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `api-keys API-Key ${process.env.PAYLOAD_CMS_API_KEY}`,
      },
    });
  } catch (error) {
    throw new CmsLoadError("Failed to reach CMS", true, { cause: error });
  }
}

async function readCmsResponse(response: Response) {
  if (!response.ok) {
    // Release unread error bodies without masking the authoritative HTTP status.
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 404) return null;

    throw new CmsLoadError(
      `Failed to load data from CMS: ${response.status}`,
      response.status >= 500,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      ["AbortError", "TimeoutError", "TypeError"].includes(String(error.name))
    ) {
      throw new CmsLoadError("Failed to read CMS response", true, {
        cause: error,
      });
    }
    throw error;
  }
}

export async function tryGetLocalizedPathname(
  request: Request,
  pathname: string,
  locale: string,
) {
  return await getData<{ localizedPathname: string }, string | null>(
    request,
    `pages/localized-pathname`,
    `localized-pathname:${pathname.substring(1).replaceAll("/", ":") || "index"}`,
    locale,
    0,
    { pathname },
    (data) => (data ? data.localizedPathname : null),
  );
}

export async function tryGetPage(
  request: Request,
  pathname: string,
  locale: string,
) {
  return await getData<{ docs: Page[] }, Page>(
    request,
    `pages`,
    `pages:${pathname.substring(1).replaceAll("/", ":") || "index"}`,
    locale,
    PAGE_DEPTH,
    {
      "where[pathname][equals]": pathname,
      limit: 1,
    },
    (data) => (data && data.docs.length > 0 ? data.docs[0] : null),
  );
}

export async function tryGetRedirect(
  request: Request,
  pathname: string,
  locale: string,
) {
  return await getData<{ docs: Redirect[] }, Redirect>(
    request,
    `redirects`,
    `redirects:${pathname.substring(1).replaceAll("/", ":") || "index"}`,
    locale,
    1,
    {
      "where[fromPathname][equals]": pathname,
      limit: 1,
    },
    (data) => (data && data.docs.length > 0 ? data.docs[0] : null),
  );
}

export async function getCommon(request: Request, locale: string) {
  const common = (await getData(
    request,
    "globals/common",
    "globals:common",
    locale,
    2,
  )) as Common | null;
  if (!common) throw new Error("Could not load Common global");

  return common;
}

export async function getFooter(request: Request, locale: string) {
  const common = (await getData(
    request,
    "globals/footer",
    "globals:footer",
    locale,
    2,
  )) as Footer | null;
  if (!common) throw new Error("Could not load Footer global");

  return common;
}

export async function getSettings(
  request: Request,
  locale: string | null = null,
) {
  const settings = (await getData(
    request,
    "globals/settings",
    "globals:settings",
    locale,
    2,
  )) as Settings | null;
  if (!settings) throw new Error("Could not load Settings global");

  return settings;
}

export async function getBrands(request: Request, locale: string) {
  const brands = (await getData(
    request,
    "brands",
    "brands",
    locale,
    BRANDS_DEPTH,
  )) as {
    docs: Brand[];
  } | null;
  if (!brands) throw new Error("Could not load Brands collection");

  return brands.docs;
}

export async function purgeCache() {
  await invalidateCmsCache();
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function getBanner(request: Request, id: string, locale: string) {
  const banner = await getData<Banner, Banner>(
    request,
    `banners/${encodeURIComponent(id)}`,
    `banners:${id}`,
    locale,
    2,
  );
  if (!banner)
    throw new Response(null, { status: 404, statusText: "Banner not found" });
  return banner;
}
