import type { Brand, LocaleConfig } from "@lapuertahostels/payload-types";
import { Banner } from "./banner";
import type { NavbarProps } from "./navbar/navbar";
import { Navbar } from "./navbar/navbar";
import { isObject } from "~/common/utils";
import { LoadingBar } from "./loading-bar";

type HeaderProps = {
  hasSession?: boolean;
  previewBanner?: boolean;
  brand: Brand;
  allBrands: Brand[];
  publishedLocales: Pick<LocaleConfig, "id" | "displayLabel">[];
} & Pick<NavbarProps, "onHeightChanged">;

export function Header({
  previewBanner = false,
  brand,
  allBrands,
  publishedLocales,
  onHeightChanged,
}: HeaderProps) {
  return (
    <header className="contents">
      {isObject(brand.banner) && (
        <Banner
          key={brand.banner.id}
          {...brand.banner}
          id={previewBanner ? undefined : brand.banner.id}
        />
      )}
      <Navbar
        brand={brand}
        allBrands={allBrands}
        publishedLocales={publishedLocales}
        onHeightChanged={onHeightChanged}
      />
      <LoadingBar />
    </header>
  );
}
