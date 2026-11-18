import { createInstance, type i18n } from "i18next";
import {
  createContext,
  createCookie,
  type MiddlewareFunction,
  type RouterContextProvider,
} from "react-router";
import { initReactI18next } from "react-i18next";
import i18nConfig from "~/i18n";
import { getSettings } from "./cms-data.server";
import { I18NextBackend } from "./i18next-backend.server";
import {
  getLocaleAndPageUrl,
  getRequestUrl,
  toRelativeUrl,
} from "./common/routing";
import type { LocaleConfig } from "@lapuertahostels/payload-types";

export const localeCookie = createCookie("locale");

const localeContext = createContext<string>();
const i18nextContext = createContext<i18n>();

export const i18nextMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const { instance, locale } = await createI18next(request);

  context.set(localeContext, locale);
  context.set(i18nextContext, instance);
  return await next();
};

export async function createI18next(request: Request) {
  const settings = await getSettings(request);
  const supportedLanguages = (
    settings.publishedLocales.publishedLocales as LocaleConfig[]
  ).map((locale) => locale.id);
  const fallbackLanguage = (
    settings.publishedLocales.fallbackLocale as LocaleConfig
  ).id;
  const { locale: urlLocale } = getLocaleAndPageUrl(
    toRelativeUrl(getRequestUrl(request)),
  );
  const locale =
    matchSupportedLocale(urlLocale, supportedLanguages) ??
    (await detectLocale(request, supportedLanguages, fallbackLanguage));

  const instance = createInstance();
  instance.use(initReactI18next).use(I18NextBackend);
  await instance.init({
    ...i18nConfig,
    backend: { request },
    fallbackLng: fallbackLanguage,
    lng: locale,
    ns: ["ui-labels"],
    supportedLngs: supportedLanguages,
  });

  return { instance, locale };
}

export function getLocale(context: Readonly<RouterContextProvider>) {
  return context.get(localeContext);
}

export function getI18next(context: Readonly<RouterContextProvider>) {
  return context.get(i18nextContext);
}

export async function getRequestLocale(request: Request) {
  const settings = await getSettings(request);
  const supportedLanguages = (
    settings.publishedLocales.publishedLocales as LocaleConfig[]
  ).map((locale) => locale.id);
  const fallbackLanguage = (
    settings.publishedLocales.fallbackLocale as LocaleConfig
  ).id;

  return detectLocale(request, supportedLanguages, fallbackLanguage);
}

export async function getHeaderLocale(request: Request) {
  const settings = await getSettings(request);
  const supportedLanguages = (
    settings.publishedLocales.publishedLocales as LocaleConfig[]
  ).map((locale) => locale.id);
  const fallbackLanguage = (
    settings.publishedLocales.fallbackLocale as LocaleConfig
  ).id;

  return (
    getAcceptedLanguages(request.headers.get("Accept-Language"))
      .map((locale) => matchSupportedLocale(locale, supportedLanguages))
      .find((locale) => locale !== undefined) ?? fallbackLanguage
  );
}

async function detectLocale(
  request: Request,
  supportedLanguages: string[],
  fallbackLanguage: string,
) {
  const requestedLocales = [
    new URL(request.url).searchParams.get("lng"),
    await localeCookie.parse(request.headers.get("Cookie")),
    ...getAcceptedLanguages(request.headers.get("Accept-Language")),
  ];

  for (const requestedLocale of requestedLocales) {
    const locale = matchSupportedLocale(requestedLocale, supportedLanguages);
    if (locale) return locale;
  }

  return fallbackLanguage;
}

function getAcceptedLanguages(header: string | null) {
  if (!header) return [];

  return header
    .split(",")
    .map((value, index) => {
      const [language, ...parameters] = value.split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      return { index, language: language?.trim(), quality };
    })
    .filter(
      (value): value is { index: number; language: string; quality: number } =>
        Boolean(value.language) &&
        Number.isFinite(value.quality) &&
        value.quality > 0,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((value) => value.language);
}

function matchSupportedLocale(
  requestedLocale: unknown,
  supportedLanguages: string[],
) {
  if (typeof requestedLocale !== "string") return undefined;
  const normalizedLocale = requestedLocale.toLowerCase();
  return supportedLanguages.find(
    (locale) =>
      locale.toLowerCase() === normalizedLocale ||
      normalizedLocale.startsWith(`${locale.toLowerCase()}-`),
  );
}
