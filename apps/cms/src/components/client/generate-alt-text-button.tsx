"use client";

import {
  Button,
  toast,
  useDocumentInfo,
  useForm,
  useFormModified,
  useLocale,
  useTranslation,
} from "@payloadcms/ui";
import { useRouter } from "next/navigation.js";
import { useState } from "react";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

import { cn } from "../../common/cn";
import { SparklesIcon } from "../../common/icons";
import styles from "./generate-alt-text-button.module.css";

export function GenerateAltTextButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const locale = useLocale();
  const { id } = useDocumentInfo();
  const { getData } = useForm();
  const router = useRouter();
  const isModified = useFormModified();
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();

  const { mimeType } = getData();
  if (!mimeType || !mimeType.includes("image/")) {
    return null;
  }

  if (typeof id !== "string") {
    throw new Error("Expected id to be a string");
  }
  return (
    <>
      <Button
        buttonStyle="secondary"
        disabled={isGenerating || isModified}
        icon={<SparklesIcon />}
        onClick={async () => {
          if (!window.confirm(t("cmsPlugin:media:generate:confirm"))) {
            return;
          }

          setIsGenerating(true);

          try {
            const result = await fetch(
              `/api/media/${id}/update-alt-text?locale=${locale.code}`,
              {
                credentials: "include",
                method: "post",
              },
            );

            if (!result.ok) {
              toast.error(t("cmsPlugin:media:generate:failure"), {
                duration: 3000,
              });
              return;
            }

            router.refresh();
            toast.success(t("cmsPlugin:media:generate:success"), {
              duration: 3000,
            });
          } finally {
            setIsGenerating(false);
          }
        }}
        size="medium"
      >
        {isGenerating
          ? t("cmsPlugin:media:generate:generating")
          : t("cmsPlugin:media:generate:generate")}
      </Button>
      {isModified && (
        <p className={cn("field-description", styles.note)}>
          {t("cmsPlugin:media:generate:pleaseSaveYourChangesToGenerateAltText")}
        </p>
      )}
    </>
  );
}
