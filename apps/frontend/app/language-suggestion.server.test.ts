import { beforeEach, expect, test, vi } from "vitest";
import type { Settings } from "@lapuertahostels/payload-types";

const { getCommon, tryGetLocalizedPathname } = vi.hoisted(() => ({
  getCommon: vi.fn(),
  tryGetLocalizedPathname: vi.fn(),
}));
vi.mock("./cms-data.server", () => ({ getCommon, tryGetLocalizedPathname }));

import { getLanguageSuggestion } from "./language-suggestion.server";
import { localeCookie } from "./i18next.server";

const settings = {
  publishedLocales: {
    publishedLocales: [
      { id: "en", displayLabel: "English" },
      { id: "es", displayLabel: "Español" },
    ],
  },
} as Settings;

beforeEach(() => {
  getCommon.mockResolvedValue({ uiLabels: {} });
  tryGetLocalizedPathname.mockResolvedValue("/azul/contacto");
});

function suggest(
  query = "",
  headers = { "Accept-Language": "es" },
  config = settings,
) {
  const url = new URL(`https://example.com/en/azul/contact${query}`);
  return getLanguageSuggestion(
    new Request(url, { headers }),
    url,
    "en",
    "/azul/contact",
    config,
  );
}

test("offers the translated destination with preferred-language defaults", async () => {
  await expect(suggest()).resolves.toEqual({
    locale: "es",
    pathname: "/azul/contacto",
    message: "Esta página también está disponible en Español.",
    switch: "Cambiar a Español",
    keep: "Continuar en English",
  });
  expect(tryGetLocalizedPathname).toHaveBeenCalledWith(
    expect.any(Request),
    "/azul/contact",
    "es",
    "none",
  );
  expect(getCommon).toHaveBeenCalledWith(expect.any(Request), "es", "none");
});

test("uses CMS copy, treating language names as plain text", async () => {
  getCommon.mockResolvedValue({
    uiLabels: {
      languageSuggestion: {
        message: "Leer en {{language}}",
        switch: "Ver {{language}}",
        keep: "Conservar {{language}}",
      },
    },
  });
  await expect(suggest()).resolves.toMatchObject({
    message: "Leer en Español",
    switch: "Ver Español",
    keep: "Conservar English",
  });
});

test.each(["?lng=en", "?lng=es-MX", "?preview=pages/123"])(
  "suppresses deliberate or preview requests: %s",
  async (query) => {
    await expect(suggest(query)).resolves.toBeUndefined();
  },
);

test("an unsupported lng does not suppress a real preference", async () => {
  await expect(suggest("?lng=fr")).resolves.toMatchObject({ locale: "es" });
});

test("does not offer a fallback or matching language", async () => {
  await expect(
    suggest("", { "Accept-Language": "fr" }),
  ).resolves.toBeUndefined();
  await expect(
    suggest("", { "Accept-Language": "en" }),
  ).resolves.toBeUndefined();
});

test("a manual preference is respected over the browser header", async () => {
  const url = new URL("https://example.com/en/azul/contact");
  const request = new Request(url, {
    headers: {
      Cookie: await localeCookie.serialize("en"),
      "Accept-Language": "es",
    },
  });
  await expect(
    getLanguageSuggestion(request, url, "en", "/azul/contact", settings),
  ).resolves.toBeUndefined();
});

test("maintenance pages have no offer", async () => {
  await expect(
    suggest(
      "",
      { "Accept-Language": "es" },
      {
        ...settings,
        maintenanceScreen: { show: true },
      },
    ),
  ).resolves.toBeUndefined();
});

test("a missing translation does not offer a broken destination", async () => {
  tryGetLocalizedPathname.mockResolvedValue(null);
  await expect(suggest()).resolves.toBeUndefined();
  expect(getCommon).not.toHaveBeenCalled();
});

test("an optional copy lookup failure does not break the page", async () => {
  getCommon.mockRejectedValue(new Error("CMS unavailable"));
  await expect(suggest()).resolves.toBeUndefined();
});
