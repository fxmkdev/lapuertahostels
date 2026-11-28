import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  isCommonPreviewScenario,
  isCommonPreviewScenarioMessage,
} from "@lapuertahostels/live-preview";
import type { CommonPreviewScenario } from "@lapuertahostels/live-preview";
import { useEnvironment } from "./environment";
import { getPreviewHost } from "./preview-bridge";

export function useCommonPreviewScenario() {
  const [params, setParams] = useSearchParams();
  const { i18n } = useTranslation();
  const { payloadCmsBaseUrl, preview } = useEnvironment();
  const origin = new URL(payloadCmsBaseUrl).origin;
  const selected = params.get("scenario");
  const scenario: CommonPreviewScenario = isCommonPreviewScenario(selected)
    ? selected
    : "notFound";
  const setScenario = useCallback(
    (next: CommonPreviewScenario) => {
      setParams(
        (current) => {
          const nextParams = new URLSearchParams(current);
          nextParams.set("scenario", next);
          return nextParams;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (selected === null || isCommonPreviewScenario(selected)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("scenario", "notFound");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [selected, setParams]);

  useEffect(() => {
    if (preview !== "globals/common") return;
    const onMessage = (event: MessageEvent<unknown>) => {
      const host = getPreviewHost();
      if (
        !host ||
        event.origin !== origin ||
        event.source !== host ||
        !isCommonPreviewScenarioMessage(event.data) ||
        event.data.locale !== i18n.language
      )
        return;
      setScenario(event.data.scenario);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, preview, i18n.language, setScenario]);

  return { scenario, setScenario };
}
