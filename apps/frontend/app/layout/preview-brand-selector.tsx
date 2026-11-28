import type { Brand } from "@lapuertahostels/payload-types";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { getPreviewBrandHref } from "~/common/shared-preview";

export function PreviewBrandSelector({
  brand,
  allBrands,
  locale,
  adminLocale,
  footer,
  headerHeight = 0,
}: {
  brand: Brand;
  allBrands: Brand[];
  locale: string;
  adminLocale: string;
  footer: boolean;
  headerHeight?: number;
}) {
  const { t } = useTranslation("admin", { lng: adminLocale });
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!footer) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("site-footer")?.scrollIntoView(),
    );
    return () => cancelAnimationFrame(frame);
  }, [brand.id, footer, headerHeight]);
  return (
    <aside
      className={
        footer
          ? undefined
          : "fixed bottom-3 left-3 z-50 rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 shadow-lg"
      }
    >
      <label className="flex items-center gap-3">
        {t("livePreview.brand")}
        <select
          className="rounded border border-neutral-300 py-1 pr-8 pl-2"
          value={brand.id}
          onChange={(event) => {
            const selected = allBrands.find(
              (entry) => entry.id === event.target.value,
            );
            const href =
              selected &&
              getPreviewBrandHref(selected, locale, location.search);
            if (href) void navigate(href, { preventScrollReset: footer });
          }}
        >
          {allBrands
            .filter((entry) =>
              getPreviewBrandHref(entry, locale, location.search),
            )
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
        </select>
      </label>
    </aside>
  );
}
