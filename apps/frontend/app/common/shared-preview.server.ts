import type { Brand } from "@lapuertahostels/payload-types";
import { redirect } from "react-router";
import { getBanner } from "~/cms-data.server";
import { getHeaderLocale } from "~/i18next.server";
import {
  getPreviewBrandHref,
  isSharedPreview,
  selectPreviewBrand,
} from "./shared-preview";

export async function loadSharedPreview(
  request: Request,
  url: URL,
  locale: string,
  allBrands: Brand[],
  isAuthorized: boolean,
) {
  const preview = url.searchParams.get("preview");
  if (!isSharedPreview(preview)) return null;
  const brand = selectPreviewBrand(
    allBrands,
    preview!,
    url.searchParams.get("previewBrand"),
  );
  if (!brand) throw new Error("Brand not found");
  const href = getPreviewBrandHref(brand, locale, url.search);
  if (isAuthorized && href && url.pathname !== new URL(href, url).pathname)
    throw redirect(href);
  const banner = preview!.startsWith("banners/")
    ? await getBanner(request, preview!.slice(8), locale)
    : null;
  return { brand, banner };
}

export async function getPreviewAdminLocale(
  request: Request,
  url: URL,
  isContentPreview: boolean,
  isMaintenance: boolean,
) {
  if (!isContentPreview && !isMaintenance) return undefined;
  const requested = url.searchParams.get("adminLng");
  if (isContentPreview && (requested === "en" || requested === "es"))
    return requested;
  return getHeaderLocale(request);
}
