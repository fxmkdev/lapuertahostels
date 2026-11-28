import { expect, test } from "vitest";
import type { PayloadRequest } from "payload";
import { livePreviewAdmin, livePreviewBridge } from "./live-preview";

const base = "https://preview.example.com";
const req = { i18n: { language: "es" } } as PayloadRequest;

test("preview configuration is disabled without a frontend URL", () => {
  expect(livePreviewAdmin(undefined, () => null)).toEqual({});
  expect(livePreviewBridge()).toEqual([]);
});

test("preview URLs keep content locale independent from editor language", () => {
  const admin = livePreviewAdmin(base, () => ({
    pathname: "/preview/common",
    documentPath: "globals/common",
  }));
  const href = admin.livePreview!.url({
    data: {},
    locale: { code: "en" },
    req,
  });
  const url = new URL(href!);
  expect(url.origin).toBe(base);
  expect(url.pathname).toBe("/preview/common");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    lng: "en",
    preview: "globals/common",
    skipcache: "true",
    adminLng: "es",
  });
});

test("unsaved new documents do not expose preview before their first save", () => {
  const admin = livePreviewAdmin(base, (data) =>
    data.id
      ? { pathname: "/", documentPath: `banners/${String(data.id)}` }
      : null,
  );
  expect(
    admin.livePreview!.url({ data: {}, locale: { code: "en" }, req }),
  ).toBeNull();
});
