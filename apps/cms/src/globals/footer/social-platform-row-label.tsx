"use client";

import type { Footer } from "@/payload-types";
import type { TranslationsKey, TranslationsObject } from "@/translations";
import { useRowLabel, useTranslation } from "@payloadcms/ui";
import { socialPlatformOptions } from "./social-platforms";

export type SocialPlatformRowLabelProps = {
  fallbackLabelKey: TranslationsKey;
};

export function SocialPlatformRowLabel({
  fallbackLabelKey,
}: SocialPlatformRowLabelProps) {
  const { data, rowNumber } =
    useRowLabel<NonNullable<NonNullable<Footer>["socialLinks"]>[number]>();
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  // using this format to match the default behavior of the RowLabel component that is initially shown
  const fallbackLabel = t(fallbackLabelKey, {
    n: (rowNumber != null ? rowNumber + 1 : 0).toString().padStart(2, "0"),
  });

  return (
    socialPlatformOptions.find((o) => o.value === data.platform)?.label ??
    fallbackLabel
  );
}
