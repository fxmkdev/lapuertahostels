import type { Common } from "@lapuertahostels/payload-types";
import type { CommonPreviewScenario } from "@lapuertahostels/live-preview";
import { COMMON_PREVIEW_SCENARIOS } from "@lapuertahostels/live-preview";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SerializeFromLoader } from "~/common/types";
import type { loader as rootLoader } from "~/root";
import { ThemeProvider } from "~/themes";
import { Header } from "./header";
import { Footer } from "./footer";
import { ErrorScreen } from "~/global-error-boundary";
import { PreviewFrame } from "./preview-frame";

export function CommonPreview({
  common,
  root,
  scenario,
  onScenarioChange,
}: {
  common: Common;
  root: SerializeFromLoader<typeof rootLoader>;
  scenario: CommonPreviewScenario;
  onScenarioChange: (value: CommonPreviewScenario) => void;
}) {
  const { t } = useTranslation("admin", { lng: root.adminLocale });
  const [headerHeight, setHeaderHeight] = useState(0);
  const brand = root.allBrands.find((brand) => brand.id === "puerta")!;
  const toolbar = (
    <label className="flex items-center gap-3">
      {t("livePreview.scenario")}
      <select
        className="rounded border border-neutral-300 py-1 pr-8 pl-2"
        value={scenario}
        onChange={(event) =>
          onScenarioChange(event.target.value as CommonPreviewScenario)
        }
      >
        {COMMON_PREVIEW_SCENARIOS.map((value) => (
          <option key={value} value={value}>
            {t(`livePreview.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <ThemeProvider themeColor={brand.themeColor}>
      <PreviewFrame
        toolbar={toolbar}
        headerHeight={headerHeight}
        resetKey={scenario}
      >
        <Header
          brand={brand}
          allBrands={root.allBrands}
          publishedLocales={root.publishedLocales}
          onHeightChanged={setHeaderHeight}
        />
        <ErrorScreen
          content={
            scenario === "serverError"
              ? common.errorScreen
              : common.pageNotFoundScreen
          }
        />
        <Footer
          content={root.footer}
          brand={brand}
          allBrands={root.allBrands}
        />
      </PreviewFrame>
    </ThemeProvider>
  );
}
