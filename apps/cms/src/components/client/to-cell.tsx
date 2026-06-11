"use client";

import type { DefaultCellComponentProps } from "payload";

import { usePayloadAPI, useTranslation } from "@payloadcms/ui";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

export function ToCell({ cellData }: DefaultCellComponentProps) {
  const [{ data: page, isError, isLoading }] = usePayloadAPI(
    `/api/pages/${encodeURIComponent(cellData.page)}`,
  );
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  if (isLoading) {
    return <div>{t("general:loading")}…</div>;
  }
  if (isError) {
    return <div>{t("error:loadingDocument", { id: cellData.page })}</div>;
  }

  return `${t("cmsPlugin:pages:labels:singular")}: ${page.pathname}${cellData.queryString ? `?${cellData.queryString}` : ""}${cellData.fragment ? `#${cellData.fragment}` : ""}`;
}
