import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getBrands, purgeCache, tryGetPage } from "./cms-data.server";
import { getCmsCachePrefix } from "./cms-cache.server";

const runRedisCommand = vi.hoisted(() => vi.fn());
vi.mock("./redis", () => ({ runRedisCommand }));

const values = new Map<string, string>();
const redis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
const fetchMock = vi.fn();
const oldPage = { id: "page-1", pathname: "/about", title: "Old" };
const newPage = { ...oldPage, title: "New" };
const loadPage = (query = "") =>
  tryGetPage(
    new Request(`https://www.example.com/about${query}`),
    "/about",
    "en",
  );
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  vi.resetAllMocks();
  values.clear();
  vi.stubEnv("PAYLOAD_CMS_BASE_URL", "https://cms.example.com");
  vi.stubEnv("PAYLOAD_CMS_API_KEY", "test-api-key");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  runRedisCommand.mockImplementation((command) => command(redis));
  redis.get.mockImplementation(async (key: string) => values.get(key) ?? null);
  redis.set.mockImplementation(
    async (
      key: string,
      value: string,
      options?: { NX?: boolean; GET?: boolean },
    ) => {
      const previous = values.get(key) ?? null;
      if (!options?.NX || previous === null) values.set(key, value);
      return options?.GET ? previous : "OK";
    },
  );
  redis.del.mockImplementation(async (key: string) =>
    Number(values.delete(key)),
  );
  fetchMock.mockImplementation(async () => json({ docs: [oldPage] }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);
const contentKey = () =>
  [...values.keys()].find((key) => key.endsWith(":pages:about:en"))!;

describe("CMS data cache", () => {
  test("serves fresh data without fetching and waits for a refresh at exactly one minute", async () => {
    await loadPage();
    advance(59_999);
    expect(await loadPage()).toEqual(oldPage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(1);
    fetchMock.mockResolvedValueOnce(json({ docs: [newPage] }));
    expect(await loadPage()).toEqual(newPage);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("sets a hard five-minute expiry without extending the lifetime for fetch latency", async () => {
    fetchMock.mockImplementationOnce(async () => {
      advance(250);
      return json({ docs: [newPage] });
    });
    await loadPage();
    expect(redis.set).toHaveBeenLastCalledWith(
      contentKey(),
      expect.any(String),
      { PX: 299_750 },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test.each(["network", "timeout", "body timeout", "body network", "server"])(
    "bounds %s failure fallback by the original age",
    async (failure) => {
      await loadPage();
      const original = values.get(contentKey());
      advance(60_000);
      const fail = () => {
        if (failure === "server") return Promise.resolve(json({}, 503));
        if (failure === "body timeout" || failure === "body network")
          return Promise.resolve({
            ok: true,
            json: async () => {
              throw failure === "body network"
                ? new TypeError("terminated")
                : new DOMException("timeout", "AbortError");
            },
          });
        return Promise.reject(
          failure === "timeout"
            ? new DOMException("timeout", "TimeoutError")
            : new TypeError("offline"),
        );
      };
      fetchMock.mockImplementation(fail);
      expect(await loadPage()).toEqual(oldPage);
      advance(239_999);
      expect(await loadPage()).toEqual(oldPage);
      expect(values.get(contentKey())).toBe(original);
      advance(1);
      await expect(loadPage()).rejects.toThrow();
      expect(
        [...values.keys()].some((key) => key.endsWith(":pages:about:en")),
      ).toBe(false);
    },
  );

  test("does not fall back if a slow refresh crosses the maximum age", async () => {
    await loadPage();
    advance(299_999);
    fetchMock.mockImplementationOnce(async () => {
      advance(1);
      throw new TypeError("offline");
    });
    await expect(loadPage()).rejects.toThrow("Failed to reach CMS");
  });

  test.each([401, 403, 429])(
    "does not mask CMS HTTP %s with stale content",
    async (status) => {
      await loadPage();
      advance(60_000);
      fetchMock.mockResolvedValueOnce(json({}, status));
      await expect(loadPage()).rejects.toThrow(String(status));
      expect(contentKey()).toBeUndefined();
    },
  );

  test.each([404, 200])(
    "removes missing content (HTTP %s) without stale fallback",
    async (status) => {
      await loadPage();
      advance(60_000);
      fetchMock.mockResolvedValueOnce(json({ docs: [] }, status));
      expect(await loadPage()).toBeNull();
      expect(contentKey()).toBeUndefined();
    },
  );

  test.each([
    "not json",
    "null",
    "{}",
    '{"data":{}}',
    '{"version":1,"data":{},"cachedAt":"bad"}',
    '{"version":1,"data":{},"cachedAt":9999999999999}',
  ])("treats malformed or legacy entry %s as a miss", async (bad) => {
    const prefix = await getCmsCachePrefix();
    values.set(`${prefix}:pages:about:en`, bad);
    expect(await loadPage()).toEqual(oldPage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("propagates invalid CMS JSON without stale fallback", async () => {
    await loadPage();
    advance(60_000);
    fetchMock.mockResolvedValueOnce(new Response("bad json"));
    await expect(loadPage()).rejects.toThrow();
  });

  test("bypasses all Redis reads, writes, and stale fallback with skipcache", async () => {
    await loadPage();
    vi.clearAllMocks();
    fetchMock.mockResolvedValueOnce(json({ docs: [newPage] }));
    expect(await loadPage("?skipcache=true")).toEqual(newPage);
    expect(runRedisCommand).not.toHaveBeenCalled();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(loadPage("?skipcache=true")).rejects.toThrow();
  });

  test("bypasses cache when Redis generation lookup fails", async () => {
    redis.get.mockRejectedValueOnce(new Error("Redis unavailable"));
    expect(await loadPage()).toEqual(oldPage);
    expect(redis.set).not.toHaveBeenCalled();
  });

  test("loads CMS content if Redis content read fails", async () => {
    await getCmsCachePrefix();
    redis.get
      .mockResolvedValueOnce([...values.values()][0])
      .mockRejectedValueOnce(new Error("read failed"));
    expect(await loadPage()).toEqual(oldPage);
  });

  test("returns CMS content even when Redis write or delete fails", async () => {
    await getCmsCachePrefix();
    redis.set.mockRejectedValueOnce(new Error("write failed"));
    expect(await loadPage()).toEqual(oldPage);
    fetchMock.mockResolvedValueOnce(json({ docs: [] }));
    redis.del.mockRejectedValueOnce(new Error("delete failed"));
    expect(await loadPage()).toBeNull();
  });

  test("purge failures propagate", async () => {
    redis.set.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(purgeCache()).rejects.toThrow("Redis unavailable");
  });

  test("an edit invalidates populated banners in brands across locales", async () => {
    const request = new Request("https://www.example.com/about");
    fetchMock.mockImplementation(async () =>
      json({ docs: [{ id: "puerta", banner: { message: "Old banner" } }] }),
    );
    await getBrands(request, "en");
    await getBrands(request, "es");
    await purgeCache();
    fetchMock.mockImplementation(async () =>
      json({ docs: [{ id: "puerta", banner: { message: "New banner" } }] }),
    );
    for (const locale of ["en", "es"]) {
      expect(await getBrands(request, locale)).toMatchObject([
        { banner: { message: "New banner" } },
      ]);
    }
  });

  test("a late fetch cannot repopulate the active generation after invalidation", async () => {
    let finish!: (value: Response) => void;
    let started!: () => void;
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchMock.mockImplementationOnce(() => {
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const oldRequest = loadPage();
    await fetching;
    await purgeCache();
    finish(json({ docs: [oldPage] }));
    await oldRequest;
    fetchMock.mockResolvedValueOnce(json({ docs: [newPage] }));
    expect(await loadPage()).toEqual(newPage);
  });

  test("initializes a missing generation atomically and honors a concurrent initializer", async () => {
    redis.set.mockImplementationOnce(async (key: string) => {
      values.set(key, "concurrent-generation");
      return "concurrent-generation";
    });
    expect(await getCmsCachePrefix()).toMatch(/:concurrent-generation$/);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/:generation$/),
      expect.any(String),
      { NX: true, GET: true },
    );
  });

  test("isolates different CMS environments sharing Redis", async () => {
    await loadPage();
    vi.stubEnv("PAYLOAD_CMS_BASE_URL", "https://other-cms.example.com");
    fetchMock.mockResolvedValueOnce(json({ docs: [newPage] }));
    expect(await loadPage()).toEqual(newPage);
    expect(
      [...values.keys()].filter((key) => key.endsWith(":generation")),
    ).toHaveLength(2);
  });

  test("generation loss never reuses an earlier namespace", async () => {
    await loadPage();
    values.delete(
      [...values.keys()].find((key) => key.endsWith(":generation"))!,
    );
    fetchMock.mockResolvedValueOnce(json({ docs: [newPage] }));
    expect(await loadPage()).toEqual(newPage);
  });
});
