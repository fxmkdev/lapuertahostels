"use client";

import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import { useRowLabel, useTranslation } from "@payloadcms/ui";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

export type RowLabelProps = {
  fallbackLabelKey?: TranslationsKey;
  textProp: string;
};

export function RowLabel({ fallbackLabelKey, textProp }: RowLabelProps) {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>();
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  fallbackLabelKey = fallbackLabelKey ?? "cmsPlugin:rowLabel:item";

  // using this format to match the default behavior of the RowLabel component that is initially shown
  const fallbackLabel = t(fallbackLabelKey, {
    n: (rowNumber != null ? rowNumber + 1 : 0).toString().padStart(2, "0"),
  });

  const value = getValueByPath(data, textProp);

  return (
    (typeof value === "object"
      ? convertLexicalToPlaintext({ data: value })
      : value) || fallbackLabel
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValueByPath(data: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], data);
}
