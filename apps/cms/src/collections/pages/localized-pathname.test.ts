import { expect, test, vi } from "vitest";
import type { PayloadRequest } from "payload";
import { getLocalizedPathnameEndpoint } from "./localized-pathname";

function makeRequest(disableFallback = false, translatedPathname?: string) {
  const findGlobal = vi.fn(async ({ req }: { req: PayloadRequest }) => {
    // Payload's local API resets request fallback when options omit it.
    req.fallbackLocale = "en";
    return {
      publishedLocales: { publishedLocales: [{ id: "en" }, { id: "es" }] },
    };
  });
  const find = vi.fn(
    async ({ fallbackLocale }: { fallbackLocale?: false }) => ({
      docs: [
        {
          pathname:
            translatedPathname ??
            (fallbackLocale === false ? undefined : "/about"),
        },
      ],
    }),
  );
  const req = {
    user: { id: "editor" },
    locale: "es",
    fallbackLocale: disableFallback ? false : "en",
    searchParams: new URLSearchParams({
      pathname: "/about",
      ...(disableFallback ? { "fallback-locale": "none" } : {}),
    }),
    payload: { config: {}, findGlobal, find },
  } as unknown as PayloadRequest;
  return { req, find };
}

test("returns the configured fallback pathname for normal routing", async () => {
  const { req, find } = makeRequest();
  const response = await getLocalizedPathnameEndpoint.handler(req);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ localizedPathname: "/about" });
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({ fallbackLocale: undefined }),
  );
});

test("rejects a missing translation even when the settings lookup resets request fallback", async () => {
  const { req, find } = makeRequest(true);
  const response = await getLocalizedPathnameEndpoint.handler(req);
  expect(response.status).toBe(404);
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({ fallbackLocale: false }),
  );
});

test("returns the target pathname when it exists with fallback disabled", async () => {
  const { req } = makeRequest(true, "/sobre");
  const response = await getLocalizedPathnameEndpoint.handler(req);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ localizedPathname: "/sobre" });
});
