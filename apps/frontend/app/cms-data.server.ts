import {
  Brand,
  Common,
  Settings,
  Page,
  Redirect,
  Footer,
} from "@lapuertahostels/payload-types";
import { BRANDS_DEPTH, PAGE_DEPTH } from "./cms-data";
import { runRedisCommand } from "./redis";

const CACHE_EXPIRY_IN_MS = 1000 * 60; // 1 min

async function loadAndCacheData<TData, TResult>(
  url: string,
  locale: string | null,
  cacheKeyWithLocale: string,
  depth: number,
  queryParams: Record<string, string>,
  getResultFn: (data: TData | null) => TResult | null,
) {
  const result = getResultFn(await loadData(url, locale, depth, queryParams));

  if (result) {
    await cacheData(cacheKeyWithLocale, result);
  } else {
    console.log(`Deleting data for ${cacheKeyWithLocale} (if exists)`);
    await deleteCachedData(cacheKeyWithLocale);
  }

  return result;
}

async function cacheData(cacheKeyWithLocale: string, data: object) {
  console.log(`Caching data to ${cacheKeyWithLocale}`);

  try {
    await runRedisCommand((redis) =>
      redis.set(
        cacheKeyWithLocale,
        JSON.stringify({
          data,
          cachedAt: new Date().toJSON(),
        } as CacheEntry<object>),
      ),
    );
  } catch (error) {
    console.warn(
      `Failed to cache data for ${cacheKeyWithLocale}. Continuing without Redis cache: ${formatError(error)}`,
    );
  }
}

async function deleteCachedData(cacheKeyWithLocale: string) {
  try {
    await runRedisCommand((redis) => redis.del(cacheKeyWithLocale));
  } catch (error) {
    console.warn(
      `Failed to delete cache entry for ${cacheKeyWithLocale}. Continuing without Redis cache: ${formatError(error)}`,
    );
  }
}

async function getCachedData(cacheKeyWithLocale: string) {
  try {
    return await runRedisCommand((redis) => redis.get(cacheKeyWithLocale));
  } catch (error) {
    console.warn(
      `Failed to read cache for ${cacheKeyWithLocale}. Treating as cache miss: ${formatError(error)}`,
    );
    return null;
  }
}

type CacheEntry<T> = {
  data: T;
  cachedAt: string;
};

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
  const cacheKeyWithLocale = `${cacheKey}${locale ? `:${locale}` : ""}`;

  if (new URL(req.url).searchParams.get("skipcache") === "true") {
    console.log(
      `Skipping cache for ${cacheKeyWithLocale} (?skipcache=true was specified)`,
    );
    return getResultFn(await loadData(pathname, locale, depth, queryParams));
  }

  const cacheEntryString = await getCachedData(cacheKeyWithLocale);
  const cacheEntry = cacheEntryString
    ? (JSON.parse(cacheEntryString) as CacheEntry<TResult>)
    : null;

  if (cacheEntry) {
    queueMicrotask(async () => {
      try {
        const cacheLastModified = cacheEntry.cachedAt;

        const cacheExpired =
          new Date(cacheLastModified).getTime() + CACHE_EXPIRY_IN_MS <
          Date.now();
        if (!cacheExpired) {
          console.log(`Cache not expired for ${cacheKeyWithLocale}`);
          return;
        }

        console.log(`Cache expired for ${cacheKeyWithLocale}`);
        await loadAndCacheData(
          pathname,
          locale,
          cacheKeyWithLocale,
          depth,
          queryParams,
          getResultFn,
        );
      } catch (e) {
        // As this runs in the background, just log the error
        console.warn(
          `Failed to refresh cache in microtask for ${cacheKeyWithLocale} (expected if data was deleted): ${e}`,
        );
      }
    });

    console.log(`Cache hit for ${cacheKeyWithLocale}`);
    return cacheEntry.data;
  }

  console.log(`Cache miss for ${cacheKeyWithLocale}`);
  return await loadAndCacheData(
    pathname,
    locale,
    cacheKeyWithLocale,
    depth,
    queryParams,
    getResultFn,
  );
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
  const response = await fetch(url, {
    headers: {
      Authorization: `api-keys API-Key ${process.env.PAYLOAD_CMS_API_KEY}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;

    throw new Error(`Failed to load data from CMS: ${response.status}`);
  }

  return await response.json();
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
  await runRedisCommand((redis) => redis.flushDb());
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
