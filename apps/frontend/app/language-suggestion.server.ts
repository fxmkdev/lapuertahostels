import type { LocaleConfig, Settings } from "@lapuertahostels/payload-types";
import { getCommon, tryGetLocalizedPathname } from "./cms-data.server";
import { getPreferredLocale, matchSupportedLocale } from "./i18next.server";
import {
  languageSuggestionDefaults,
  type LanguageSuggestion,
} from "./language-suggestion";

export async function getLanguageSuggestion(
  request: Request,
  url: URL,
  currentLocale: string,
  pathname: string,
  settings: Settings,
): Promise<LanguageSuggestion | undefined> {
  try {
    if (settings.maintenanceScreen?.show || url.searchParams.has("preview"))
      return undefined;

    const locales = settings.publishedLocales
      .publishedLocales as LocaleConfig[];
    const codes = locales.map((locale) => locale.id);
    if (matchSupportedLocale(url.searchParams.get("lng"), codes))
      return undefined;
    const preferredLocale = await getPreferredLocale(request, codes);
    if (!preferredLocale || preferredLocale === currentLocale) return undefined;

    const localizedPathname = await tryGetLocalizedPathname(
      request,
      pathname,
      preferredLocale,
    );
    if (!localizedPathname) return undefined;

    // Prefer our translated defaults over labels inherited from another CMS locale.
    const common = await getCommon(request, preferredLocale, "none");
    const labels = common.uiLabels?.languageSuggestion;
    const defaults =
      preferredLocale.toLowerCase().split("-")[0] === "es"
        ? languageSuggestionDefaults.es
        : languageSuggestionDefaults.en;
    const preferredName = locales.find(
      (l) => l.id === preferredLocale,
    )!.displayLabel;
    const currentName = locales.find(
      (l) => l.id === currentLocale,
    )?.displayLabel;
    if (!currentName) return undefined;
    const format = (
      label: string | null | undefined,
      fallback: string,
      name: string,
    ) => (label?.trim() || fallback).replaceAll("{{language}}", name);

    return {
      locale: preferredLocale,
      pathname: localizedPathname,
      message: format(labels?.message, defaults.message, preferredName),
      switch: format(labels?.switch, defaults.switch, preferredName),
      keep: format(labels?.keep, defaults.keep, currentName),
    };
  } catch {
    // An optional offer must never prevent the requested page from loading.
    return undefined;
  }
}
