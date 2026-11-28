import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ActionFunctionArgs, MiddlewareFunction } from "react-router";
import { createStaticHandler } from "react-router";
import { i18nextMiddleware } from "./i18next.server";
import { action } from "./routes/api.invalidate-cms-cache";

const invalidateCmsCache = vi.hoisted(() => vi.fn());
const getSettings = vi.hoisted(() => vi.fn());
vi.mock("~/cms-data.server", () => ({ getSettings, getCommon: vi.fn() }));
vi.mock("~/cms-cache.server", () => ({ invalidateCmsCache }));
// Adapt the static handler's generic middleware to resource-route Responses.
const resourceMiddleware: MiddlewareFunction = (args, next) =>
  i18nextMiddleware(args, async () => {
    const response = await next();
    if (!(response instanceof Response)) throw new Error("Expected a Response");
    return response;
  });
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

test.each([
  "/api/invalidate-cms-cache",
  "/api/invalidate-cms-cache/?source=cms",
  "/API/INVALIDATE-CMS-CACHE",
])(
  "authenticates %s through root middleware without contacting the CMS",
  async (pathname) => {
    getSettings.mockRejectedValue(new Error("CMS is unavailable"));
    const handler = createStaticHandler([
      {
        id: "root",
        path: "/",
        middleware: [resourceMiddleware],
        children: [
          { id: "invalidate", path: "api/invalidate-cms-cache", action },
        ],
      },
    ]);

    for (const [token, expectedStatus] of [
      ["Bearer wrong", 401],
      ["Bearer shared-secret", 204],
    ] as const) {
      const request = new Request(`https://frontend.example.com${pathname}`, {
        method: "POST",
        headers: { Authorization: token },
      });
      const response = await handler.queryRoute(request, {
        generateMiddlewareResponse: (queryRoute) => queryRoute(request),
      });
      expect(response.status).toBe(expectedStatus);
    }
    expect(getSettings).not.toHaveBeenCalled();
    expect(invalidateCmsCache).toHaveBeenCalledTimes(1);
  },
);

test("still loads CMS translations for other resource routes", async () => {
  getSettings.mockRejectedValue(new Error("CMS is unavailable"));
  const handler = createStaticHandler([
    {
      id: "root",
      path: "/",
      middleware: [resourceMiddleware],
      children: [{ path: "api/ui-labels", loader: () => Response.json({}) }],
    },
  ]);
  const request = new Request(
    "https://frontend.example.com/api/ui-labels?lng=en",
  );
  await expect(
    handler.queryRoute(request, {
      generateMiddlewareResponse: (queryRoute) => queryRoute(request),
    }),
  ).rejects.toThrow("CMS is unavailable");
  expect(getSettings).toHaveBeenCalledWith(request);
});
