import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  type LinksFunction,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
  useRouteError,
} from "react-router";

import styles from "./global.css?url";
import { useTranslation } from "react-i18next";
import type { BrandId } from "./brands";
import {
  getBrands,
  getCommon,
  getFooter,
  getSettings,
  tryGetPage,
} from "./cms-data.server";
import { OptInLivePreview } from "./common/live-preview";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import {
  getLocaleAndPageUrl,
  getRequestUrl,
  toRelativeUrl,
  toUrl,
} from "./common/routing";
import type { Brand, LocaleConfig } from "@lapuertahostels/payload-types";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { AnalyticsScript } from "./analytics-script";
import { getAnalyticsScriptUrl } from "./analytics-proxy.server";
import { i18nextMiddleware } from "./i18next.server";
import { isAuthenticated } from "./common/auth";
import { getVersion } from "./common/version.server";
import { APIProvider as GoogleMapsAPIProvider } from "@vis.gl/react-google-maps";
import { BRANDS_DEPTH } from "./cms-data";
import { isCommonPreview } from "./common/shared-preview";
import {
  getPreviewAdminLocale,
  loadSharedPreview,
} from "./common/shared-preview.server";
import { SiteLayout } from "./layout/site-layout";

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

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const brandId = (loaderData?.brand?.id as BrandId) ?? "puerta";
  return [
    ...(loaderData?.isContentPreview
      ? [{ name: "robots", content: "noindex, nofollow" }]
      : []),
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

export const middleware = [i18nextMiddleware];

export async function loader({ request, url }: LoaderFunctionArgs) {
  if (!process.env.PAYLOAD_CMS_BASE_URL) {
    throw new Error("PAYLOAD_CMS_BASE_URL is not set");
  }
  if (!process.env.IMAGEKIT_BASE_URL) {
    throw new Error("IMAGEKIT_BASE_URL is not set");
  }

  const requestUrl = getRequestUrl(request, url);
  const { pageUrl, locale } = getLocaleAndPageUrl(toRelativeUrl(requestUrl));
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
  const preview = requestUrl.searchParams.get("preview");
  const sharedPreview = await loadSharedPreview(
    request,
    requestUrl,
    locale,
    allBrands,
    isAuthorized,
  );
  const brand = sharedPreview?.brand ?? allBrands.find((b) => b.id === brandId);
  if (!brand) throw new Error("Brand not found");
  const banner = sharedPreview?.banner ?? null;
  const isContentPreview = !!sharedPreview || isCommonPreview(preview, pageUrl);
  return {
    isAuthorized,
    isContentPreview,
    banner,
    locale,
    adminLocale: await getPreviewAdminLocale(
      request,
      requestUrl,
      isContentPreview,
      !!settings.maintenanceScreen?.show,
    ),
    brand,
    allBrands,
    settings,
    common,
    footer,
    environment: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY!,
      version: getVersion(),
      payloadCmsBaseUrl:
        process.env.PAYLOAD_CMS_PUBLIC_URL ?? process.env.PAYLOAD_CMS_BASE_URL,
      imagekitBaseUrl: process.env.IMAGEKIT_BASE_URL,
      preview: requestUrl.searchParams.get("preview") || undefined,
      useImageCacheBuster: false, // Cache busting is only used in Storybook for Chromatic
    },
    analyticsEnabled: !isContentPreview && !!getAnalyticsScriptUrl(),
    publishedLocales: settings.publishedLocales
      .publishedLocales as LocaleConfig[],
  };
}

export const handle = {
  // In the handle export, we can add a i18n key with namespaces our route
  // will need to load. This key can be a single string or an array of strings.
  // TIP: In most cases, you should set this to your defaultNS from your i18n config
  // or if you did not set one, set it to the i18next default namespace "translation"
  i18n: "ui-labels",
};

const HeaderHeightContext = createContext<(height: number) => void>(() => {});

export function Layout({ children }: { children: ReactNode }) {
  const rootLoaderData = useRouteLoaderData<typeof loader>("root");
  const error = useRouteError();
  const { i18n } = useTranslation();
  const [headerHeight, setHeaderHeight] = useState(0);
  const isMaintenanceError =
    isRouteErrorResponse(error) && error.status === 503;

  return (
    <html
      lang={i18n.language}
      dir={i18n.dir()}
      style={
        error
          ? undefined
          : { scrollPaddingTop: getScrollTopPadding(headerHeight) }
      }
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {rootLoaderData && !isMaintenanceError && (
          <AnalyticsScript enabled={rootLoaderData.analyticsEnabled} />
        )}
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        <HeaderHeightContext value={setHeaderHeight}>
          {children}
        </HeaderHeightContext>
        {!error && <ScrollRestoration />}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  const {
    brand,
    settings,
    footer,
    banner,
    environment,
    publishedLocales,
    isContentPreview,
  } = data;
  const { i18n } = useTranslation();
  const setHeaderHeight = useContext(HeaderHeightContext);

  if (isContentPreview && environment.preview === "globals/common")
    return <Outlet />;

  return (
    <GoogleMapsAPIProvider
      apiKey={environment.googleMapsApiKey}
      language={
        publishedLocales.find((l) => l.id === i18n.language)
          ?.googleMapsLanguage ?? undefined
      }
      region={settings.maps?.region || undefined}
    >
      <OptInLivePreview
        path={`brands/${brand.id}`}
        data={brand}
        depth={BRANDS_DEPTH}
      >
        {(liveBrand) => {
          const renderSite = (
            previewBrand: Brand,
            previewFooter: typeof footer,
          ) => (
            <SiteLayout
              {...data}
              brand={previewBrand}
              footer={previewFooter}
              previewBanner={!!banner}
              onHeaderHeightChanged={setHeaderHeight}
            />
          );
          return banner ? (
            <OptInLivePreview
              path={`banners/${banner.id}`}
              data={banner}
              depth={2}
            >
              {(liveBanner) =>
                renderSite({ ...liveBrand, banner: liveBanner }, footer)
              }
            </OptInLivePreview>
          ) : (
            <OptInLivePreview path="globals/footer" data={footer} depth={2}>
              {(liveFooter) => renderSite(liveBrand, liveFooter)}
            </OptInLivePreview>
          );
        }}
      </OptInLivePreview>
    </GoogleMapsAPIProvider>
  );
}

const ADDITIONAL_SCROLL_PADDING = 32;

function getScrollTopPadding(headerHeight: number) {
  return headerHeight + ADDITIONAL_SCROLL_PADDING;
}

export const ErrorBoundary = GlobalErrorBoundary;
