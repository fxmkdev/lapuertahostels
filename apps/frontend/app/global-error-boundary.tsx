import {
  isRouteErrorResponse,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { Trans, useTranslation } from "react-i18next";
import type { loader as rootLoader } from "./root";
import { getTitle } from "./common/meta";
import { ThemeProvider } from "./themes";
import { Header } from "./layout/header";
import { HeroHeadingBlock } from "./blocks/hero-heading-block";
import { StoryBlock } from "./blocks/story-block";
import { Footer } from "./layout/footer";
import { MaintenanceScreen } from "./layout/maintenance-screen";
import type { Settings, Common } from "@lapuertahostels/payload-types";
import { richTextRoot } from "@lapuertahostels/rich-text";

export function GlobalErrorBoundary() {
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const error = useRouteError();
  console.error(error);

  // Without rootLoaderData, we just render a fatal error screen
  if (!rootLoaderData) return <FatalErrorScreen />;

  const { common, footer, brand, allBrands, settings, publishedLocales } =
    rootLoaderData;

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
    <>
      <title>{errorPageTitle}</title>
      <ThemeProvider themeColor={brand.themeColor}>
        <Header
          brand={brand}
          allBrands={allBrands}
          publishedLocales={publishedLocales}
        />
        <ErrorScreen
          content={
            isPageNotFound ? common.pageNotFoundScreen : common.errorScreen
          }
        />
        <Footer allBrands={allBrands} brand={brand} content={footer} />
      </ThemeProvider>
    </>
  );
}

export function FatalErrorScreen() {
  const { t } = useTranslation();
  return (
    <>
      <title>{getTitle(t("errorBoundary.title"), undefined)}</title>
      <main className="mx-auto my-36 max-w-xl text-neutral-800">
        <h1 className="mb-12 font-serif text-4xl leading-relaxed tracking-tight md:text-5xl md:leading-relaxed">
          {t("errorBoundary.title")}
        </h1>
        <Trans
          i18nKey="errorBoundary.text"
          components={{ p: <p className="my-6 text-lg" /> }}
        />
      </main>
    </>
  );
}

function MaintenanceErrorScreen({ settings }: { settings: Settings }) {
  return (
    <>
      <title>{settings.maintenanceScreen!.message}</title>
      <ThemeProvider themeColor="puerta">
        <MaintenanceScreen {...settings.maintenanceScreen!} />
      </ThemeProvider>
    </>
  );
}

export function ErrorScreen({ content }: { content: Common["errorScreen"] }) {
  return (
    <main>
      <HeroHeadingBlock
        blockType="HeroHeading"
        heading={content?.heading || ""}
      />
      <StoryBlock blockType="Story" text={content?.text || richTextRoot()} />
    </main>
  );
}
