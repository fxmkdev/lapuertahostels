export function isCommonPreview(
  preview: string | null | undefined,
  pageUrl: string,
) {
  return (
    preview === "globals/common" &&
    new URL(pageUrl, "http://preview.local").pathname === "/preview/common"
  );
}

import type { Brand } from "@lapuertahostels/payload-types";
import { getBrandHomeHref } from "./page-link";

export function isSharedPreview(path?: string | null) {
  return path === "globals/footer" || /^banners\/[^/?#]+$/.test(path ?? "");
}

export function selectPreviewBrand(
  brands: Brand[],
  preview: string,
  requested?: string | null,
) {
  const explicit = brands.find((brand) => brand.id === requested);
  if (explicit) return explicit;
  const ordered = ["puerta", "aqua", "azul"].flatMap((id) =>
    brands.filter((brand) => brand.id === id),
  );
  const bannerId = preview.startsWith("banners/") ? preview.slice(8) : null;
  return (
    (bannerId &&
      ordered.find(
        (brand) =>
          (typeof brand.banner === "object"
            ? brand.banner?.id
            : brand.banner) === bannerId,
      )) ||
    ordered[0] ||
    brands[0]
  );
}

export function getPreviewBrandHref(
  brand: Brand,
  locale: string,
  search: string,
) {
  const home = getBrandHomeHref(brand, locale);
  if (home === "about:blank") return null;
  const url = new URL(home, "http://preview.local");
  const params = new URLSearchParams(search);
  params.set("previewBrand", brand.id);
  params.set("skipcache", "true");
  url.search = params.toString();
  return url.pathname + url.search;
}
