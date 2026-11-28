import type { Common } from "@lapuertahostels/payload-types";
import { useRouteLoaderData } from "react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SerializeFromLoader } from "~/common/types";
import type { loader as rootLoader } from "~/root";
import { ThemeProvider } from "~/themes";
import { Header } from "./header";
import { Footer } from "./footer";
import { Banner } from "./banner";
import { ErrorScreen, FatalErrorScreen } from "~/global-error-boundary";
import { HeroSlidesBlock } from "~/blocks/slides-block/hero-slides-block";
import { ImageViewerControlsOverlay } from "~/common/image-viewer/image-viewer-controls-overlay";
import { MoreImagesLabel } from "~/common/image-viewer/image-viewer";
import { MaintenanceScreen } from "./maintenance-screen";
import { LoginForm } from "./login-form";

export function CommonPreview({
  common,
  root,
  scenario,
  onScenarioChange,
}: {
  common: Common;
  root: SerializeFromLoader<typeof rootLoader>;
  scenario: string;
  onScenarioChange: (value: string) => void;
}) {
  const { t } = useTranslation("admin", { lng: root.adminLocale });
  const brand = root.allBrands.find((brand) => brand.id === "puerta")!;
  return (
    <ThemeProvider themeColor={brand.themeColor}>
      <div className="sticky top-0 z-50 border-b border-neutral-300 bg-white p-3 text-sm">
        <label className="flex items-center gap-3">
          {t("livePreview.scenario")}
          <select
            className="rounded border border-neutral-300 py-1 pr-8 pl-2"
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value)}
          >
            {["notFound", "serverError", "labels"].map((value) => (
              <option key={value} value={value}>
                {t(`livePreview.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Header
        brand={brand}
        allBrands={root.allBrands}
        publishedLocales={root.publishedLocales}
      />
      {scenario === "labels" ? (
        <LabelExamples root={root} />
      ) : (
        <ErrorScreen
          content={
            scenario === "serverError"
              ? common.errorScreen
              : common.pageNotFoundScreen
          }
        />
      )}
      {scenario !== "labels" && (
        <Footer
          content={root.footer}
          brand={brand}
          allBrands={root.allBrands}
        />
      )}
    </ThemeProvider>
  );
}

function Example({
  title,
  labels = [],
  children,
}: {
  title: string;
  labels?: string[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const adminLocale =
    useRouteLoaderData<typeof rootLoader>("root")?.adminLocale;
  const { t: adminT } = useTranslation("admin", { lng: adminLocale });
  return (
    <section className="space-y-4 border-b border-neutral-200 py-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
      {labels.length > 0 && (
        <div className="rounded bg-neutral-100 p-3 text-sm">
          <h3 className="font-semibold">
            {adminT("livePreview.accessibleLabels")}
          </h3>
          <ul>
            {labels.map((key) => (
              <li key={key}>{t(key, { slide: 1 })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LabelExamples({
  root,
}: {
  root: SerializeFromLoader<typeof rootLoader>;
}) {
  const { t } = useTranslation("admin", { lng: root.adminLocale });
  const brand = root.allBrands.find((brand) => brand.id === "puerta")!;
  return (
    <div
      className="mx-auto max-w-5xl px-6"
      onSubmitCapture={(event) => event.preventDefault()}
    >
      <Example
        title={t("livePreview.bannerExample")}
        labels={["banner.dismiss"]}
      >
        <Banner message="La Puerta Hostels" />
      </Example>
      <Example
        title={t("livePreview.slidesExample")}
        labels={["slidesBlock.goToSlide"]}
      >
        <HeroSlidesBlock
          slides={[
            { image: "preview-placeholder-one" },
            { image: "preview-placeholder-two" },
          ]}
        />
      </Example>
      <Example
        title={t("livePreview.viewerExample")}
        labels={[
          "imageViewer.previous",
          "imageViewer.next",
          "imageViewer.fullscreen",
          "imageViewer.exitFullscreen",
          "imageViewer.close",
        ]}
      >
        <ViewerExample />
        <p>
          <MoreImagesLabel count={1} />
        </p>
        <p>
          <MoreImagesLabel count={2} />
        </p>
      </Example>
      <Example title={t("livePreview.loginExample")}>
        <LoginForm preview />
      </Example>
      <Example title={t("livePreview.maintenanceExample")}>
        <MaintenanceScreen message="La Puerta Hostels" />
      </Example>
      <Example
        title={t("livePreview.newsletterExample")}
        labels={["footer.heading", "footer.newsletter.emailLabel"]}
      >
        <Footer
          content={{
            ...root.footer,
            newsletter: {
              show: true,
              title: "Newsletter",
              description: "La Puerta Hostels",
              emailPlaceholder: "Email",
              buttonLabel: "Subscribe",
            },
          }}
          brand={brand}
          allBrands={root.allBrands}
        />
      </Example>
      <Example title={t("livePreview.fatalExample")}>
        <FatalErrorScreen />
      </Example>
    </div>
  );
}

function ViewerExample() {
  const [fullscreen, setFullscreen] = useState(false);
  const [index, setIndex] = useState(0);
  return (
    <div className="relative h-64 transform-gpu overflow-hidden rounded bg-neutral-700">
      <ImageViewerControlsOverlay
        supportsFullscreen
        isFullscreen={fullscreen}
        currentImageIndex={index}
        numberOfImages={2}
        onDismiss={() => {
          setIndex(0);
          setFullscreen(false);
        }}
        onGoToNextImage={() => setIndex((index + 1) % 2)}
        onGoToPreviousImage={() => setIndex((index + 1) % 2)}
        onEnterFullscreen={() => setFullscreen(true)}
        onExitFullscreen={() => setFullscreen(false)}
      />
    </div>
  );
}
