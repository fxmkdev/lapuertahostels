"use client";

import { useEffect } from "react";
import {
  useDocumentInfo,
  useLivePreviewContext,
  useLocale,
} from "@payloadcms/ui";
import {
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
} from "@lapuertahostels/live-preview";
import type {
  CommonPreviewScenario as Scenario,
  CommonPreviewScenarioMessage,
} from "@lapuertahostels/live-preview";

export function CommonPreviewScenario({
  scenario,
  previewOrigin,
}: {
  scenario: Scenario;
  previewOrigin: string;
}) {
  const { globalSlug } = useDocumentInfo();
  const { code: locale } = useLocale();
  const {
    appIsReady,
    isLivePreviewing,
    isPopupOpen,
    previewWindowType,
    iframeRef,
    popupRef,
    loadedURL,
    url,
  } = useLivePreviewContext();
  useEffect(() => {
    if (
      globalSlug !== "common" ||
      !previewOrigin ||
      !appIsReady ||
      !isLivePreviewing ||
      typeof url !== "string" ||
      new URL(url).origin !== previewOrigin
    )
      return;
    const target =
      previewWindowType === "popup"
        ? popupRef?.current
        : iframeRef.current?.contentWindow;
    if (!target || target.closed) return;
    const message: CommonPreviewScenarioMessage = {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "scenario",
      documentPath: "globals/common",
      locale,
      scenario,
    };
    target.postMessage(message, previewOrigin);
  }, [
    globalSlug,
    locale,
    scenario,
    previewOrigin,
    appIsReady,
    isLivePreviewing,
    isPopupOpen,
    previewWindowType,
    iframeRef,
    popupRef,
    loadedURL,
    url,
  ]);
  return null;
}
