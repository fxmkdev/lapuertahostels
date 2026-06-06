import {
  LoaderFunctionArgs,
  MetaFunction,
  type LinksFunction,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import styles from "./global.css?url";
import { useTranslation } from "react-i18next";
import { Footer } from "./layout/footer";
import { BrandId } from "./brands";
import {
  getBrands,
  getCommon,
  getFooter,
  getSettings,
  tryGetPage,
} from "./cms-data.server";
import { OptInLivePreview } from "./common/live-preview";
import { ThemeProvider } from "./themes";
import { useState } from "react";
import { Header } from "./layout/header";
import {
  getLocaleAndPageUrl,
  getRequestUrl,
  toRelativeUrl,
  toUrl,
} from "./common/routing";
import { Brand, LocaleConfig } from "@lapuertahostels/payload-types";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { AnalyticsScript } from "./analytics-script";
import { PreviewBar } from "./layout/preview-bar";
import { LanguageDetector } from "remix-i18next/server";
import { createRemixI18Next } from "./i18next.server";
import { isAuthenticated } from "./common/auth";
import { getVersion } from "./common/version.server";
import { APIProvider as GoogleMapsAPIProvider } from "@vis.gl/react-google-maps";
import { BRANDS_DEPTH } from "./cms-data";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Playfair%20Display:wght@400..500&display=swap",
  },
];

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const brandId = (data?.brand?.id as BrandId) ?? "puerta";
  return [
    {
      tagName: "link",
      rel: "icon",
      type: "image/png",
      sizes: "96x96",
      href: `/assets/${brandId}/favicon-96x96.png`,
    },
    {
      tagName: "link",
      rel: "icon",
      type: "image/svg+xml",
      href: `/assets/${brandId}/favicon.svg`,
    },
    {
      tagName: "link",
      rel: "shortcut icon",
      href: `/assets/${brandId}/favicon.ico`,
    },
    {
      tagName: "link",
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: `/assets/${brandId}/apple-touch-icon.png`,
    },
    {
      tagName: "link",
      rel: "manifest",
      sizes: "180x180",
      href: `/assets/${brandId}/site.webmanifest`,
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  if (!process.env.PAYLOAD_CMS_BASE_URL) {
    throw new Error("PAYLOAD_CMS_BASE_URL is not set");
  }
  if (!process.env.IMAGEKIT_BASE_URL) {
    throw new Error("IMAGEKIT_BASE_URL is not set");
  }

  const url = getRequestUrl(request);
  const { pageUrl, locale } = getLocaleAndPageUrl(toRelativeUrl(url));
  if (!locale) throw new Error("Locale has not been determined");

  const [page, allBrands, common, settings, footer] = await Promise.all([
    tryGetPage(request, toUrl(pageUrl).pathname, locale),
    getBrands(request, locale),
    getCommon(request, locale),
    getSettings(request, locale),
    getFooter(request, locale),
  ]);

  // If maintenance screen is not enabled, public access is authorized
  // Otherwise, check if the user is authenticated
  const isAuthorized =
    !settings.maintenanceScreen?.show || (await isAuthenticated(request));

  // retrieving the brand from `allBrands`, `page.brand` does not have the right depth
  const brandId = page
    ? ((page.brand as Brand).id as BrandId)
    : ("puerta" as BrandId);
  const brand = allBrands.find((b) => b.id === brandId);
  if (!brand) throw new Error("Brand not found");

  return {
    isAuthorized,
    locale,
    adminLocale: settings.maintenanceScreen?.show
      ? await loadAdminLocale()
      : undefined,
    brand,
    allBrands,
    settings,
    common,
    footer,
    environment: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY!,
      version: getVersion(),
      payloadCmsBaseUrl: process.env.PAYLOAD_CMS_BASE_URL,
      imagekitBaseUrl: process.env.IMAGEKIT_BASE_URL,
      preview: getRequestUrl(request).searchParams.get("preview") || undefined,
      useImageCacheBuster: false, // Cache busting is only used in Storybook for Chromatic
    },
    analyticsDomain: process.env.ANALYTICS_DOMAIN,
    publishedLocales: settings.publishedLocales
      .publishedLocales as LocaleConfig[],
  };

  async function loadAdminLocale() {
    const remixI18Next = await createRemixI18Next(request);
    // The admin should be able to test the page in any locale, but see the admin controls in their preferred locale.
    // Therefore only using header for the admin locale (unfortunately we cannot get the user's locale from Payload CMS)
    return await new LanguageDetector({
      ...remixI18Next["options"].detection,
      order: ["header"],
    }).detect(request);
  }
}

export const handle = {
  // In the handle export, we can add a i18n key with namespaces our route
  // will need to load. This key can be a single string or an array of strings.
  // TIP: In most cases, you should set this to your defaultNS from your i18n config
  // or if you did not set one, set it to the i18next default namespace "translation"
  i18n: "ui-labels",
};

export default function App() {
  const {
    brand,
    settings,
    footer,
    analyticsDomain,
    allBrands,
    isAuthorized,
    adminLocale,
    environment,
    publishedLocales,
  } = useLoaderData<typeof loader>();
  const { i18n } = useTranslation();

  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <html
      lang={i18n.language}
      dir={i18n.dir()}
      style={{ scrollPaddingTop: getScrollTopPadding(headerHeight) }}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <AnalyticsScript analyticsDomain={analyticsDomain} />
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        <GoogleMapsAPIProvider
          apiKey={environment.googleMapsApiKey}
          language={
            publishedLocales.find((l) => l.id === i18n.language)
              ?.googleMapsLanguage ?? undefined
          }
          region={settings.maps?.region || undefined}
        >
          <ThemeProvider themeColor={brand.themeColor}>
            {settings.maintenanceScreen?.show && isAuthorized && (
              <PreviewBar adminLocale={adminLocale!} />
            )}
            <OptInLivePreview
              path={`brands/${brand.id}`}
              data={brand}
              depth={BRANDS_DEPTH}
            >
              {(brand) => (
                <>
                  {isAuthorized && (
                    <Header
                      brand={brand}
                      allBrands={allBrands}
                      publishedLocales={publishedLocales}
                      onHeightChanged={setHeaderHeight}
                    />
                  )}
                  <main>
                    <Outlet />
                  </main>
                  {isAuthorized && (
                    <Footer
                      brand={brand}
                      allBrands={allBrands}
                      content={footer}
                    />
                  )}
                </>
              )}
            </OptInLivePreview>
          </ThemeProvider>
        </GoogleMapsAPIProvider>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const ADDITIONAL_SCROLL_PADDING = 32;

function getScrollTopPadding(headerHeight: number) {
  return headerHeight + ADDITIONAL_SCROLL_PADDING;
}

export const ErrorBoundary = GlobalErrorBoundary;
