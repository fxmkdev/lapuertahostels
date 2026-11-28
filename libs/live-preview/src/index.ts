export const PREVIEW_CHANNEL = "lapuerta-live-preview";
export const PREVIEW_VERSION = 1;
export const PREVIEW_FETCH_TIMEOUT = 10_000;
export const PREVIEW_REPLY_TIMEOUT = 15_000;

export type PreviewRequest = {
  channel: typeof PREVIEW_CHANNEL;
  version: typeof PREVIEW_VERSION;
  type: "populate";
  requestId: string;
  documentPath: string;
  locale: string;
  depth: number;
};

export type PreviewResult = {
  channel: typeof PREVIEW_CHANNEL;
  version: typeof PREVIEW_VERSION;
  type: "result";
  requestId: string;
  status: number;
  data?: unknown;
};

function isMessage(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "channel" in value &&
    value.channel === PREVIEW_CHANNEL &&
    "version" in value &&
    value.version === PREVIEW_VERSION &&
    "requestId" in value &&
    typeof value.requestId === "string" &&
    value.requestId.length > 0 &&
    value.requestId.length <= 128
  );
}

export function isPreviewRequest(value: unknown): value is PreviewRequest {
  return (
    isMessage(value) &&
    value.type === "populate" &&
    typeof value.documentPath === "string" &&
    /^(pages|brands)\/[^/?#]+$/.test(value.documentPath) &&
    typeof value.locale === "string" &&
    value.locale.length > 0 &&
    value.locale.length <= 32 &&
    typeof value.depth === "number" &&
    Number.isInteger(value.depth) &&
    value.depth >= 0 &&
    value.depth <= 3
  );
}

export function isPreviewResult(value: unknown): value is PreviewResult {
  return (
    isMessage(value) &&
    value.type === "result" &&
    typeof value.status === "number" &&
    Number.isInteger(value.status) &&
    (value.status === 200 || (value.status >= 400 && value.status <= 599))
  );
}

export function isPreviewDocument(document: unknown, expectedId: unknown) {
  return (
    document !== null &&
    typeof document === "object" &&
    !Array.isArray(document) &&
    "id" in document &&
    (typeof document.id === "string" || typeof document.id === "number") &&
    document.id === expectedId &&
    !("errors" in document)
  );
}
