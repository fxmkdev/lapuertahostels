import { beforeEach, describe, expect, test, vi } from "vitest";

const getSettings = vi.hoisted(() => vi.fn());
const getCommon = vi.hoisted(() => vi.fn());

vi.mock("./cms-data.server", () => ({ getCommon, getSettings }));

import {
  createI18next,
  getHeaderLocale,
  getRequestLocale,
  localeCookie,
} from "./i18next.server";

beforeEach(() => {
  getSettings.mockResolvedValue({
    publishedLocales: {
      fallbackLocale: { id: "en" },
      publishedLocales: [{ id: "en" }, { id: "es" }],
    },
  });
  getCommon.mockResolvedValue({ uiLabels: {} });
});

describe("server locale detection", () => {
  test("uses a localized pathname before a locale cookie or request header", async () => {
    const cookie = await localeCookie.serialize("en");
    const request = new Request("https://example.com/es/about", {
      headers: { "Accept-Language": "en", Cookie: cookie },
    });

    await expect(createI18next(request)).resolves.toMatchObject({
      locale: "es",
    });
  });

  test("uses Accept-Language quality values for redirects and admin controls", async () => {
    const request = new Request("https://example.com/", {
      headers: { "Accept-Language": "en;q=0.1, es;q=1.0" },
    });

    await expect(getRequestLocale(request)).resolves.toBe("es");
    await expect(getHeaderLocale(request)).resolves.toBe("es");
  });
});
