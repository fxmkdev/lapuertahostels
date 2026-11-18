import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { action } from "./routes/api.invalidate-cms-cache";

const invalidateCmsCache = vi.hoisted(() => vi.fn());
vi.mock("~/cms-cache.server", () => ({ invalidateCmsCache }));
const invoke = (token?: string, method = "POST") =>
  action({
    request: new Request(
      "https://frontend.example.com/api/invalidate-cms-cache",
      {
        method,
        headers: token ? { Authorization: token } : {},
      },
    ),
  } as ActionFunctionArgs);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CMS_CACHE_INVALIDATION_SECRET", "shared-secret");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("rotates cache generation for an authenticated POST", async () => {
  expect((await invoke("Bearer shared-secret")).status).toBe(204);
  expect(invalidateCmsCache).toHaveBeenCalledTimes(1);
});
test.each([undefined, "Bearer wrong", "Bearer shared-secrex"])(
  "rejects invalid credentials %s",
  async (token) => {
    expect((await invoke(token)).status).toBe(401);
    expect(invalidateCmsCache).not.toHaveBeenCalled();
  },
);
test("fails closed when the server secret is missing", async () => {
  vi.stubEnv("CMS_CACHE_INVALIDATION_SECRET", "");
  expect((await invoke("Bearer shared-secret")).status).toBe(503);
  expect(invalidateCmsCache).not.toHaveBeenCalled();
});
test("reports Redis invalidation failures", async () => {
  invalidateCmsCache.mockRejectedValueOnce(new Error("Redis unavailable"));
  expect((await invoke("Bearer shared-secret")).status).toBe(503);
});
test("allows POST only", async () => {
  expect((await invoke("Bearer shared-secret", "PUT")).status).toBe(405);
  expect(invalidateCmsCache).not.toHaveBeenCalled();
});
