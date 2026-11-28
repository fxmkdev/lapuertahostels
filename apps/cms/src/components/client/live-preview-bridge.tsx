"use client";

import { useEffect } from "react";
import {
  useConfig,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
} from "@payloadcms/ui";
import {
  isGlobalPreviewPath,
  isPreviewPath,
} from "@lapuertahostels/live-preview";
import { listenForPreviewRequests } from "./preview-bridge-handler";

export function LivePreviewBridge({
  previewOrigin,
}: {
  previewOrigin: string;
}) {
  const { id, collectionSlug, globalSlug } = useDocumentInfo();
  const documentPath = globalSlug
    ? `globals/${globalSlug}`
    : `${collectionSlug}/${id}`;
  const global = isGlobalPreviewPath(documentPath);
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
      !isPreviewPath(documentPath) ||
      (!global && (!id || !collectionSlug)) ||
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
            documentPath,
            id: global ? undefined : id!,
            locale,
            apiRoute: config.routes.api,
            getData,
          }
        : null;
    });
  }, [
    id,
    collectionSlug,
    documentPath,
    global,
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
