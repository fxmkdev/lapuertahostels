"use client";

import { useTranslation } from "@payloadcms/ui";

import type { LabelData } from "../../common/labels";

import { getLabelText } from "../../common/labels";

export function Label({ children }: { children: LabelData }) {
  const { i18n } = useTranslation();
  return getLabelText(children, i18n);
}
