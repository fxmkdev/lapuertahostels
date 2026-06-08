import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { purgeCache, tryGetPage } from "./cms-data.server";

const runRedisCommand = vi.hoisted(() => vi.fn());

vi.mock("./redis", () => ({
  runRedisCommand,
}));

type MockRedisClient = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  flushDb: ReturnType<typeof vi.fn>;
};

const redis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  flushDb: vi.fn(),
} satisfies MockRedisClient;
const fetchMock = vi.fn();

beforeEach(() => {
  runRedisCommand.mockReset();
  redis.get.mockReset();
  redis.set.mockReset();
  redis.del.mockReset();
  redis.flushDb.mockReset();
  fetchMock.mockReset();
  vi.stubEnv("PAYLOAD_CMS_BASE_URL", "https://cms.example.com");
  vi.stubEnv("PAYLOAD_CMS_API_KEY", "test-api-key");
  vi.stubGlobal("fetch", fetchMock);
  runRedisCommand.mockImplementation((command) => command(redis));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CMS data cache", () => {
  test("treats Redis get failures as cache misses and loads from the CMS", async () => {
    const page = { id: "page-1", pathname: "/about" };
    redis.get.mockRejectedValue(new Error("Redis unavailable"));
    redis.set.mockResolvedValue("OK");
    fetchMock.mockResolvedValue(createJsonResponse({ docs: [page] }));

    await expect(
      tryGetPage(new Request("https://www.example.com/about"), "/about", "en"),
    ).resolves.toBe(page);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  test("continues returning CMS data when Redis set fails", async () => {
    const page = { id: "page-1", pathname: "/about" };
    redis.get.mockResolvedValue(null);
    redis.set.mockRejectedValue(new Error("Redis write failed"));
    fetchMock.mockResolvedValue(createJsonResponse({ docs: [page] }));

    await expect(
      tryGetPage(new Request("https://www.example.com/about"), "/about", "en"),
    ).resolves.toBe(page);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  test("continues returning null when Redis delete fails for missing CMS data", async () => {
    redis.get.mockResolvedValue(null);
    redis.del.mockRejectedValue(new Error("Redis delete failed"));
    fetchMock.mockResolvedValue(createJsonResponse({ docs: [] }));

    await expect(
      tryGetPage(
        new Request("https://www.example.com/missing"),
        "/missing",
        "en",
      ),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  test("throws when cache purge fails", async () => {
    const error = new Error("Redis flush failed");
    redis.flushDb.mockRejectedValue(error);

    await expect(purgeCache()).rejects.toThrow(error);
  });
});

function createJsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}
