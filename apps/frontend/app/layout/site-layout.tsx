import type {
  Brand,
  Footer as FooterContent,
} from "@lapuertahostels/payload-types";
import { useCallback, useState } from "react";
import { Outlet } from "react-router";
import type { loader as rootLoader } from "~/root";
import type { SerializeFromLoader } from "~/common/types";
import { isSharedPreview } from "~/common/shared-preview";
import { ThemeProvider } from "~/themes";
import { PreviewBar } from "./preview-bar";
import { PreviewBrandSelector } from "./preview-brand-selector";
import { Header } from "./header";
import { Footer } from "./footer";
import { PreviewFrame } from "./preview-frame";

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

export function SiteLayout(props: SiteLayoutProps) {
  const footerPreview = props.environment.preview === "globals/footer";
  const [headerHeight, setHeaderHeight] = useState(0);
  const onHeaderHeightChanged = useCallback(
    (height: number) => {
      if (footerPreview) setHeaderHeight(height);
      props.onHeaderHeightChanged(height);
    },
    [footerPreview, props.onHeaderHeightChanged],
  );
  const selector = isSharedPreview(props.environment.preview) ? (
    <PreviewBrandSelector
      brand={props.brand}
      allBrands={props.allBrands}
      locale={props.locale}
      adminLocale={props.adminLocale!}
      footer={footerPreview}
      headerHeight={headerHeight}
    />
  ) : null;
  const content = (
    <SiteContent {...props} onHeaderHeightChanged={onHeaderHeightChanged} />
  );
  return (
    <ThemeProvider themeColor={props.brand.themeColor}>
      {footerPreview ? (
        <PreviewFrame toolbar={selector} headerHeight={headerHeight}>
          {content}
        </PreviewFrame>
      ) : (
        <>
          {selector}
          {content}
        </>
      )}
    </ThemeProvider>
  );
}

function SiteContent({
  brand,
  footer,
  previewBanner,
  onHeaderHeightChanged,
  settings,
  isAuthorized,
  adminLocale,
  allBrands,
  publishedLocales,
}: SiteLayoutProps) {
  return (
    <>
      {settings.maintenanceScreen?.show && isAuthorized && (
        <PreviewBar adminLocale={adminLocale!} />
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
    </>
  );
}
