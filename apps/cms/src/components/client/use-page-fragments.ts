import { useConfig, useLocale } from "@payloadcms/ui";
import { useEffect, useState } from "react";

import { getPageFragmentOptions } from "./fragment-options";

type FragmentResult = {
  url: string;
  options: ReturnType<typeof getPageFragmentOptions>;
  failed: boolean;
};

export function usePageFragments(pageId: string | undefined) {
  const { config } = useConfig();
  const { code: locale } = useLocale();
  const [result, setResult] = useState<FragmentResult>();
  const params = new URLSearchParams({
    depth: "0",
    "select[hero]": "true",
    "select[content]": "true",
    ...(locale ? { locale } : {}),
  });
  const url = pageId
    ? `${config.serverURL}${config.routes.api}/pages/${encodeURIComponent(pageId)}?${params}`
    : undefined;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    async function loadOptions(requestUrl: string) {
      try {
        const response = await fetch(requestUrl, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load page anchors");
        const page: unknown = await response.json();
        if (!controller.signal.aborted) {
          setResult({
            url: requestUrl,
            options: getPageFragmentOptions(page),
            failed: false,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ url: requestUrl, options: [], failed: true });
        }
      }
    }

    void loadOptions(url);
    return () => controller.abort();
  }, [url]);

  const currentResult = result?.url === url ? result : undefined;
  return {
    options: currentResult?.options ?? [],
    failed: currentResult?.failed ?? false,
    isLoading: Boolean(url && !currentResult),
  };
}
