import { expect, test } from "vitest";
import { brand, banner } from "./cms-data.builders";
import {
  getPreviewBrandHref,
  isSharedPreview,
  isCommonPreview,
  selectPreviewBrand,
} from "./shared-preview";

const edited = banner("Unsaved banner");
const puerta = brand({ id: "puerta", rootPath: "/" });
const aqua = brand({ id: "aqua", rootPath: "/aqua", banner: edited });
const azul = brand({ id: "azul", rootPath: "/azul", banner: edited.id });
const brands = [azul, puerta, aqua];

test("defaults to the first referencing brand and supports an unassigned banner", () => {
  expect(selectPreviewBrand(brands, `banners/${edited.id}`).id).toBe("aqua");
  expect(selectPreviewBrand(brands, "banners/unassigned").id).toBe("puerta");
  expect(selectPreviewBrand(brands, "globals/footer").id).toBe("puerta");
  expect(selectPreviewBrand(brands, `banners/${edited.id}`, "azul").id).toBe(
    "azul",
  );
  expect(selectPreviewBrand(brands, "globals/footer", "unknown").id).toBe(
    "puerta",
  );
});

test("brand navigation retains document, language, and cache bypass", () => {
  const href = getPreviewBrandHref(
    aqua,
    "es",
    "?preview=globals/footer&lng=es&adminLng=en&skipcache=true",
  );
  const url = new URL(href!, "http://preview.local");
  expect(url.pathname).toBe("/es/aqua");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    preview: "globals/footer",
    lng: "es",
    adminLng: "en",
    skipcache: "true",
    previewBrand: "aqua",
  });
  expect(isSharedPreview("globals/common")).toBe(false);
  expect(isSharedPreview("banners/../users")).toBe(false);
});

test("Common's dedicated layout is limited to its reserved route", () => {
  expect(
    isCommonPreview("globals/common", "/preview/common?scenario=labels"),
  ).toBe(true);
  expect(isCommonPreview("globals/common", "/aqua")).toBe(false);
  expect(isCommonPreview(undefined, "/preview/common")).toBe(false);
});
