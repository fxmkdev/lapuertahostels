"use client";

import { useEffect } from "react";
import {
  useConfig,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
} from "@payloadcms/ui";
import { listenForPreviewRequests } from "./preview-bridge-handler";

export function LivePreviewBridge({
  previewOrigin,
}: {
  previewOrigin: string;
}) {
  const { id, collectionSlug } = useDocumentInfo();
  const { getData } = useForm();
  const { config } = useConfig();
  const { code: locale } = useLocale();
  const {
    isLivePreviewing,
    previewWindowType,
    iframeRef,
    popupRef,
    url,
    loadedURL,
  } = useLivePreviewContext();

  useEffect(() => {
    if (
      !isLivePreviewing ||
      !previewOrigin ||
      !id ||
      !collectionSlug ||
      !url ||
      new URL(url).origin !== previewOrigin
    )
      return;
    return listenForPreviewRequests(previewOrigin, () => {
      const previewWindow =
        previewWindowType === "popup"
          ? popupRef?.current
          : iframeRef.current?.contentWindow;
      return previewWindow && !previewWindow.closed
        ? {
            previewWindow,
            documentPath: `${collectionSlug}/${id}`,
            id,
            locale,
            apiRoute: config.routes.api,
            getData,
          }
        : null;
    });
  }, [
    id,
    collectionSlug,
    locale,
    getData,
    config.routes.api,
    isLivePreviewing,
    previewWindowType,
    iframeRef,
    popupRef,
    url,
    loadedURL,
    previewOrigin,
  ]);

  return null;
}
