import type { PayloadRequest } from "payload";

export function getLivePreviewUrl(
  baseUrl: string,
  pathname: string,
  dataPath: string,
  locale: string,
) {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set("lng", locale);
  url.searchParams.set("preview", dataPath);
  url.searchParams.set("skipcache", "true");
  return url.toString();
}

type PreviewDestination = { pathname: string; documentPath: string };

export function livePreviewAdmin(
  baseUrl: string | undefined,
  destination: (data: Record<string, unknown>) => PreviewDestination | null,
) {
  if (!baseUrl) return {};
  return {
    livePreview: {
      url: ({
        data,
        locale,
        req,
      }: {
        data: Record<string, unknown>;
        locale: { code: string };
        req: PayloadRequest;
      }) => {
        const target = destination(data);
        if (!target) return null;
        const url = new URL(
          getLivePreviewUrl(
            baseUrl,
            target.pathname,
            target.documentPath,
            locale.code,
          ),
        );
        url.searchParams.set("adminLng", req.i18n.language);
        return url.toString();
      },
    },
  };
}

export function livePreviewBridge(baseUrl?: string) {
  return baseUrl
    ? [
        {
          path: "/src/components/client/live-preview-bridge#LivePreviewBridge",
          clientProps: { previewOrigin: new URL(baseUrl).origin },
        },
      ]
    : [];
}
