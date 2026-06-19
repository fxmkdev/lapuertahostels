"use client";

import type { CollectionSlug, GlobalSlug, Locale } from "payload";

import {
  Button,
  Drawer,
  toast,
  useModal,
  useTranslation,
} from "@payloadcms/ui";
import { useState } from "react";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

import { getLabelText } from "../../common/labels";
import { Label } from "./labels";
import { CheckboxInput } from "./translation-checkbox-input";
import styles from "./translations-select-locales-drawer.module.css";

type SelectLocalesDrawerProps = {
  collectionSlug?: CollectionSlug;
  currentLocale: Locale;
  fieldPath: string;
  globalSlug?: GlobalSlug;
  id?: string;
  isTranslating: boolean;
  locales: Locale[];
  modalSlug: string;
  setIsTranslating: (isTranslating: boolean) => void;
  updateData: () => Promise<void>;
};

export function SelectLocalesDrawer({
  id,
  collectionSlug,
  currentLocale,
  fieldPath,
  globalSlug,
  isTranslating,
  locales,
  modalSlug,
  setIsTranslating,
  updateData,
}: SelectLocalesDrawerProps) {
  const { closeModal } = useModal();
  const { i18n, t } = useTranslation<TranslationsObject, TranslationsKey>();
  const otherLocales = locales.filter(
    (locale) => locale.code !== currentLocale.code,
  );
  const [selectedLocaleCodes, setSelectedLocaleCodes] = useState(
    otherLocales.map((locale) => locale.code),
  );

  return (
    <Drawer slug={modalSlug} title={t("cmsPlugin:translations:selectLocales")}>
      <div className={styles.selectLocalesText}>
        <p>
          {renderDeepLDescription(
            t("cmsPlugin:translations:selectLocalesDescription", {
              sourceLocale: getLabelText(currentLocale.label, i18n),
            }),
          )}
        </p>
      </div>
      <div className={styles.selectLocalesList}>
        {otherLocales.map((locale) => (
          <div key={locale.code}>
            <CheckboxInput
              checked={selectedLocaleCodes.includes(locale.code)}
              label={<Label>{locale.label}</Label>}
              name={`locale-${locale.code}`}
              setChecked={(checked) =>
                setSelectedLocaleCodes((slc) =>
                  checked
                    ? [...slc, locale.code]
                    : slc.filter((lc) => lc !== locale.code),
                )
              }
            />
          </div>
        ))}
      </div>

      <p className={styles.selectLocalesNote}>
        {renderStrongNote(t("cmsPlugin:translations:selectLocalesNote"))}
      </p>
      <div className={styles.selectLocalesFooter}>
        <Button
          disabled={isTranslating || selectedLocaleCodes.length === 0}
          onClick={async () => {
            setIsTranslating(true);
            try {
              const searchParams = new URLSearchParams();
              if (collectionSlug) {
                searchParams.set("collection", collectionSlug);
              }
              if (id) {
                searchParams.set("id", id);
              }
              if (globalSlug) {
                searchParams.set("global", globalSlug);
              }
              searchParams.set("fieldPath", fieldPath);
              searchParams.set("locale", currentLocale.code);
              const response = await fetch(
                `/api/auto-translate?${searchParams.toString()}`,
                {
                  body: JSON.stringify({
                    targetLocaleCodes: selectedLocaleCodes,
                  }),
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  method: "POST",
                },
              );
              if (response.ok) {
                await updateData();
                closeModal(modalSlug);
                toast.success(
                  t("cmsPlugin:translations:autoTranslatedSuccessfully"),
                  {
                    duration: 3000,
                  },
                );
              } else {
                toast.error(t("cmsPlugin:translations:failedToAutoTranslate"), {
                  duration: 3000,
                });
              }
            } finally {
              setIsTranslating(false);
            }
          }}
          size="large"
          type="submit"
        >
          {isTranslating
            ? t("cmsPlugin:translations:translating")
            : t("cmsPlugin:translations:translateToSelectedLocales")}
        </Button>
      </div>
    </Drawer>
  );
}

function renderDeepLDescription(text: string) {
  const parts = splitSimpleTag(text, "a");
  if (!parts) {
    return text;
  }

  return (
    <>
      {parts.before}
      <a href="https://www.deepl.com" rel="noreferrer noopener" target="_blank">
        {parts.inner}
      </a>
      {parts.after}
    </>
  );
}

function renderStrongNote(text: string) {
  const parts = splitSimpleTag(text, "s");
  if (!parts) {
    return text;
  }

  return (
    <>
      {parts.before}
      <strong>{parts.inner}</strong>
      {parts.after}
    </>
  );
}

function splitSimpleTag(text: string, tag: string) {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const openTagIndex = text.indexOf(openTag);
  const closeTagIndex = text.indexOf(closeTag);

  if (
    openTagIndex === -1 ||
    closeTagIndex === -1 ||
    closeTagIndex < openTagIndex
  ) {
    return null;
  }

  return {
    after: text.slice(closeTagIndex + closeTag.length),
    before: text.slice(0, openTagIndex),
    inner: text.slice(openTagIndex + openTag.length, closeTagIndex),
  };
}
