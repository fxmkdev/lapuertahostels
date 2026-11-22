// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import {
  getAnalyticsScriptUrl,
  proxyAnalyticsEvent,
  proxyAnalyticsScript,
} from "./analytics-proxy.server";

const getSettings = vi.hoisted(() => vi.fn());
vi.mock("./cms-data.server", () => ({ getSettings }));
import { i18nextMiddleware } from "./i18next.server";

const scriptUrl = "https://plausible.io/js/pa-mNmGQe_APpMrQMvTp8u6q.js";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("ANALYTICS_SCRIPT_URL", scriptUrl);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  getSettings.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function eventRequest(headers: HeadersInit = {}, body = '{"n":"pageview"}') {
  return new Request("https://example.com/api/event", {
    method: "POST",
    headers: {
      "Fly-Client-IP": "2001:db8::1",
      "Content-Type": "text/plain",
      ...headers,
    },
    body,
  });
}

describe("analytics configuration", () => {
  test("accepts the site-specific HTTPS script", () => {
    expect(getAnalyticsScriptUrl()).toBe(scriptUrl);
  });
  test.each([
    "",
    "invalid",
    "http://plausible.io/js/script.js",
    "https://plausible.io.evil.test/js/script.js",
    "https://plausible.io:8443/js/script.js",
    "https://user:password@plausible.io/js/script.js",
    "https://plausible.io/api/event",
    "https://plausible.io/js/../api/script.js",
    `${scriptUrl}?target=other`,
    `${scriptUrl}#other`,
  ])("disables invalid configuration: %s", (value) => {
    vi.stubEnv("ANALYTICS_SCRIPT_URL", value);
    expect(getAnalyticsScriptUrl()).toBeUndefined();
  });
  test("disabled routes return uncached 404s without fetching", async () => {
    vi.stubEnv("ANALYTICS_SCRIPT_URL", "");
    for (const response of [
      await proxyAnalyticsScript(
        new Request("https://example.com/js/script.js"),
      ),
      await proxyAnalyticsEvent(eventRequest()),
    ]) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("script proxy", () => {
  test("serves the script and cache metadata without leaking response headers", async () => {
    fetchMock.mockResolvedValue(
      new Response("/* real script */", {
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=60, no-transform",
          ETag: '"version"',
          "Last-Modified": "Sun, 22 Nov 2026 00:00:00 GMT",
          "Content-Encoding": "gzip",
          "Content-Length": "10",
          "Set-Cookie": "private=value",
        },
      }),
    );
    const request = new Request(
      "https://example.com/js/script.js?ignored=true",
      {
        headers: { Cookie: "session=private", Authorization: "secret" },
      },
    );
    const response = await proxyAnalyticsScript(request);
    expect(await response.text()).toBe("/* real script */");
    expect(response.headers.get("content-type")).toBe("application/javascript");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, no-transform",
    );
    expect(response.headers.get("etag")).toBe('"version"');
    expect(response.headers.get("last-modified")).toBeTruthy();
    for (const name of ["content-encoding", "content-length", "set-cookie"]) {
      expect(response.headers.has(name)).toBe(false);
    }
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(scriptUrl);
    expect([...(options!.headers as Headers)]).toEqual([]);
    expect(options).toMatchObject({ method: "GET", redirect: "error" });
  });

  test("supports HEAD without a response body", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: { "Content-Type": "application/javascript" },
      }),
    );
    const response = await proxyAnalyticsScript(
      new Request("https://example.com/js/script.js", { method: "HEAD" }),
    );
    expect(await response.text()).toBe("");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
  });
});

describe("event proxy", () => {
  test.each(["text/plain", "application/json"])(
    "forwards unchanged %s payload and browser headers",
    async (contentType) => {
      const body =
        '{ "n": "pageview", "d": "lapuertahostels.co", "u": "https://example.com/en" }\n';
      const browserHeaders = {
        "Content-Type": contentType,
        "User-Agent": "Browser agent",
        Accept: "*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        Origin: "https://example.com",
        Referer: "https://example.com/en",
        "Sec-CH-UA": '"Chromium";v="130"',
        "Sec-CH-UA-Platform": '"macOS"',
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "X-Debug-Request": "true",
      };
      fetchMock.mockResolvedValue(
        new Response("{}", {
          status: 202,
          headers: {
            "Content-Type": "application/json",
            "x-plausible-dropped": "1",
            "Cache-Control": "public, max-age=60",
            "Set-Cookie": "upstream=private",
          },
        }),
      );
      const response = await proxyAnalyticsEvent(
        eventRequest(
          {
            ...browserHeaders,
            Cookie: "session=private",
            Authorization: "secret",
            "X-Forwarded-For": "spoofed",
            "CF-Connecting-IP": "spoofed",
            "Proxy-Authorization": "secret",
            "X-Api-Key": "secret",
          },
          body,
        ),
      );
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://plausible.io/api/event");
      expect(new TextDecoder().decode(options!.body as ArrayBuffer)).toBe(body);
      expect(options).toMatchObject({ method: "POST", redirect: "error" });
      const headers = options!.headers as Headers;
      for (const [name, value] of Object.entries(browserHeaders)) {
        expect(headers.get(name)).toBe(value);
      }
      expect(headers.get("x-forwarded-for")).toBe("2001:db8::1");
      for (const name of [
        "cookie",
        "authorization",
        "cf-connecting-ip",
        "fly-client-ip",
        "proxy-authorization",
        "x-api-key",
      ]) {
        expect(headers.has(name)).toBe(false);
      }
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("{}");
      expect(response.headers.get("x-plausible-dropped")).toBe("1");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("set-cookie")).toBe(false);
    },
  );

  test("accepts IPv4 from Fly", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await proxyAnalyticsEvent(
      eventRequest({ "Fly-Client-IP": "198.51.100.42" }),
    );
    expect(
      (fetchMock.mock.calls[0][1]!.headers as Headers).get("x-forwarded-for"),
    ).toBe("198.51.100.42");
  });

  test.each(["", "invalid", "198.51.100.1, 198.51.100.2"])(
    "rejects invalid visitor IP: %s",
    async (ip) => {
      const response = await proxyAnalyticsEvent(
        eventRequest({
          "Fly-Client-IP": ip,
          "X-Forwarded-For": "198.51.100.42",
        }),
      );
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("proxy failures and routing", () => {
  test.each(["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])(
    "restricts methods: %s",
    async (method) => {
      const request = new Request("https://example.com/", { method });
      if (!["GET", "HEAD"].includes(method)) {
        const response = await proxyAnalyticsScript(request);
        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toBe("GET, HEAD");
      }
      if (method !== "POST") {
        const response = await proxyAnalyticsEvent(request);
        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toBe("POST");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test.each([proxyAnalyticsScript, proxyAnalyticsEvent])(
    "returns uncached gateway failures",
    async (handler) => {
      fetchMock.mockRejectedValue(new Error("Network unavailable"));
      const response = await handler(
        handler === proxyAnalyticsEvent
          ? eventRequest()
          : new Request("https://example.com/js/script.js"),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  test("times out after ten seconds", async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    fetchMock.mockImplementation(async () => {
      controller.abort();
      throw new Error("Timeout");
    });
    const response = await proxyAnalyticsEvent(eventRequest());
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("preserves upstream errors without caching them", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream error", {
        status: 503,
        headers: { "Cache-Control": "public" },
      }),
    );
    const response = await proxyAnalyticsScript(
      new Request("https://example.com/js/script.js"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("upstream error");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test.each(["/js/script.js", "/api/event"])(
    "bypasses CMS translations for %s",
    async (pathname) => {
      const request = new Request(`https://example.com${pathname}`);
      const next = vi.fn().mockResolvedValue(new Response("proxy response"));
      const response = await i18nextMiddleware(
        {
          request,
          context: new RouterContextProvider(),
          params: {},
          pattern: "*",
          url: new URL(request.url),
        },
        next,
      );
      expect(await response!.text()).toBe("proxy response");
      expect(next).toHaveBeenCalledOnce();
      expect(getSettings).not.toHaveBeenCalled();
    },
  );

  test("does not bypass translations for similar paths", async () => {
    getSettings.mockRejectedValue(new Error("CMS called"));
    const request = new Request("https://example.com/api/event/other");
    const next = vi.fn();
    await expect(
      i18nextMiddleware(
        {
          request,
          context: new RouterContextProvider(),
          params: {},
          pattern: "*",
          url: new URL(request.url),
        },
        next,
      ),
    ).rejects.toThrow("CMS called");
    expect(next).not.toHaveBeenCalled();
  });
});
