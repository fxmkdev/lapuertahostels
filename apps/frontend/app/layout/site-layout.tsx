import type {
  Brand,
  Footer as FooterContent,
} from "@lapuertahostels/payload-types";
import { Outlet } from "react-router";
import type { loader as rootLoader } from "~/root";
import type { SerializeFromLoader } from "~/common/types";
import { isSharedPreview } from "~/common/shared-preview";
import { ThemeProvider } from "~/themes";
import { PreviewBar } from "./preview-bar";
import { PreviewBrandSelector } from "./preview-brand-selector";
import { Header } from "./header";
import { Footer } from "./footer";

type SiteLayoutProps = Pick<
  SerializeFromLoader<typeof rootLoader>,
  | "settings"
  | "isAuthorized"
  | "adminLocale"
  | "allBrands"
  | "locale"
  | "environment"
  | "publishedLocales"
> & {
  brand: Brand;
  footer: FooterContent;
  previewBanner: boolean;
  onHeaderHeightChanged: (height: number) => void;
};

export function SiteLayout({
  brand,
  footer,
  previewBanner,
  onHeaderHeightChanged,
  settings,
  isAuthorized,
  adminLocale,
  allBrands,
  locale,
  environment,
  publishedLocales,
}: SiteLayoutProps) {
  return (
    <ThemeProvider themeColor={brand.themeColor}>
      {settings.maintenanceScreen?.show && isAuthorized && (
        <PreviewBar adminLocale={adminLocale!} />
      )}
      {isSharedPreview(environment.preview) && (
        <PreviewBrandSelector
          brand={brand}
          allBrands={allBrands}
          locale={locale}
          adminLocale={adminLocale!}
          footer={environment.preview === "globals/footer"}
        />
      )}
      {isAuthorized && (
        <Header
          brand={brand}
          previewBanner={previewBanner}
          allBrands={allBrands}
          publishedLocales={publishedLocales}
          onHeightChanged={onHeaderHeightChanged}
        />
      )}
      <main>
        <Outlet />
      </main>
      {isAuthorized && (
        <Footer brand={brand} allBrands={allBrands} content={footer} />
      )}
    </ThemeProvider>
  );
}
