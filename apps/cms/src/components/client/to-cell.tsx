"use client";

import type { DefaultCellComponentProps } from "payload";

import { usePayloadAPI, useTranslation } from "@payloadcms/ui";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

export function ToCell({ cellData }: DefaultCellComponentProps) {
  const pageId = normalizePageId(cellData.page);

  if (!pageId) {
    return <MissingPageCell />;
  }

  return (
    <PageCell
      fragment={cellData.fragment}
      pageId={pageId}
      queryString={cellData.queryString}
    />
  );
}

function MissingPageCell() {
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  return <div>{t("error:loadingDocument", { id: "" })}</div>;
}

function PageCell({
  fragment,
  pageId,
  queryString,
}: {
  fragment?: string;
  pageId: string;
  queryString?: string;
}) {
  const [{ data: page, isError, isLoading }] = usePayloadAPI(
    `/api/pages/${encodeURIComponent(pageId)}`,
  );
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  if (isLoading) {
    return <div>{t("general:loading")}…</div>;
  }
  if (isError) {
    return <div>{t("error:loadingDocument", { id: pageId ?? "" })}</div>;
  }

  return `${t("cmsPlugin:pages:labels:singular")}: ${page.pathname}${queryString ? `?${queryString}` : ""}${fragment ? `#${fragment}` : ""}`;
}

function normalizePageId(page: unknown) {
  if (typeof page === "number" || typeof page === "string") {
    return String(page);
  }

  if (
    page &&
    typeof page === "object" &&
    "id" in page &&
    (typeof page.id === "number" || typeof page.id === "string")
  ) {
    return String(page.id);
  }

  return undefined;
}
