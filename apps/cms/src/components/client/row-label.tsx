"use client";

import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

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

  if (typeof value === "string") {
    return value || fallbackLabel;
  }

  if (isSerializedEditorState(value)) {
    return convertLexicalToPlaintext({ data: value }) || fallbackLabel;
  }

  return fallbackLabel;
}

function getValueByPath(data: Record<string, unknown>, path: string) {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) => (isRecord(value) ? value[key] : undefined),
      data,
    );
}

function isSerializedEditorState(
  value: unknown,
): value is SerializedEditorState {
  return isRecord(value) && isRecord(value.root);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
