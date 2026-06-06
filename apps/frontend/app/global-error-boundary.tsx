import {
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { loader as rootLoader } from "./root";
import { getTitle } from "./common/meta";
import { ThemeProvider } from "./themes";
import { Header } from "./layout/header";
import { HeroHeadingBlock } from "./blocks/hero-heading-block";
import { StoryBlock } from "./blocks/story-block";
import { Footer } from "./layout/footer";
import { AnalyticsScript } from "./analytics-script";
import { MaintenanceScreen } from "./layout/maintenance-screen";
import { Settings } from "@lapuertahostels/payload-types";
import { richTextRoot } from "@fxmk/common";

export function GlobalErrorBoundary() {
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const error = useRouteError();
  console.error(error);

  const { i18n } = useTranslation();

  // Without rootLoaderData, we just render a fatal error screen
  if (!rootLoaderData) return <FatalErrorScreen />;

  const {
    common,
    footer,
    brand,
    allBrands,
    analyticsDomain,
    settings,
    publishedLocales,
  } = rootLoaderData;

  if (isRouteErrorResponse(error) && error.status === 503) {
    return <MaintenanceErrorScreen settings={settings} />;
  }

  const isPageNotFound = isRouteErrorResponse(error) && error.status === 404;

  const errorPageTitle = getTitle(
    (isPageNotFound
      ? common.pageNotFoundScreen?.heading
      : common.errorScreen?.heading) || "",
    brand,
  );

  return (
    <html lang={i18n.language} dir={i18n.dir()}>
      <head>
        <title>{errorPageTitle}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <AnalyticsScript analyticsDomain={analyticsDomain} />
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        <ThemeProvider themeColor={brand.themeColor}>
          <Header
            brand={brand}
            allBrands={allBrands}
            publishedLocales={publishedLocales}
          />
          <main>
            <HeroHeadingBlock
              blockType="HeroHeading"
              heading={
                (isPageNotFound
                  ? common.pageNotFoundScreen?.heading
                  : common.errorScreen?.heading) || ""
              }
            />

            <StoryBlock
              blockType="Story"
              text={
                (isPageNotFound
                  ? common.pageNotFoundScreen?.text
                  : common.errorScreen?.text) || richTextRoot()
              }
            />
          </main>
          <Footer allBrands={allBrands} brand={brand} content={footer} />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function FatalErrorScreen() {
  const { i18n, t } = useTranslation();
  return (
    <html lang={i18n.language} dir={i18n.dir()}>
      <head>
        <title>{getTitle(t("errorBoundary.title"), undefined)}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        <main className="mx-auto my-36 max-w-xl text-neutral-800">
          <h1 className="mb-12 font-serif text-4xl leading-relaxed tracking-tight md:text-5xl md:leading-relaxed">
            {t("errorBoundary.title")}
          </h1>
          <Trans
            i18nKey="errorBoundary.text"
            components={{ p: <p className="my-6 text-lg" /> }}
          />
        </main>
        <Scripts />
      </body>
    </html>
  );
}

function MaintenanceErrorScreen({ settings }: { settings: Settings }) {
  const { i18n } = useTranslation();
  return (
    <html lang={i18n.language} dir={i18n.dir()}>
      <head>
        <title>{settings.maintenanceScreen!.message}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-white text-neutral-900 antialiased">
        <ThemeProvider themeColor="puerta">
          <MaintenanceScreen {...settings.maintenanceScreen!} />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  );
}
