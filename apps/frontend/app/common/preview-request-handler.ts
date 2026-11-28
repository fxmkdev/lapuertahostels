import { isPreviewDocument } from "@lapuertahostels/live-preview";
import {
  createPreviewBridgeClient,
  PreviewConnectionError,
} from "./preview-bridge";
import type { useLivePreview } from "@payloadcms/live-preview-react";

type RequestHandler = NonNullable<
  Parameters<typeof useLivePreview>[0]["requestHandler"]
>;

export type PreviewSnapshot<T> = {
  data: T;
  error: "authentication" | "request" | "connection" | null;
};

export function createPreviewRequestHandler<T>({
  initialData,
  documentPath,
  locale,
  onChange,
}: {
  initialData: T;
  documentPath: string;
  locale: string;
  onChange: (snapshot: PreviewSnapshot<T>) => void;
}) {
  const bridge = createPreviewBridgeClient(documentPath, locale);
  let lastValidData = initialData;
  let latestRequest = 0;
  const expectedId = (initialData as { id?: unknown }).id;

  const requestHandler: RequestHandler = async (args) => {
    const request = ++latestRequest;
    let error: PreviewSnapshot<T>["error"] = "request";

    try {
      const response = await bridge.request(
        args.serverURL,
        args.data.depth ?? 0,
      );

      if (response.status === 401 || response.status === 403) {
        error = "authentication";
      }
      if (!response.ok) throw new Error("Preview request failed");

      const document: unknown = await response.json();
      if (!isPreviewDocument(document, expectedId)) {
        throw new Error("Invalid preview document");
      }

      if (request === latestRequest) {
        lastValidData = document as T;
        onChange({ data: lastValidData, error: null });
      }
    } catch (cause) {
      if (cause instanceof PreviewConnectionError) error = "connection";
      if (request === latestRequest) {
        onChange({ data: lastValidData, error });
      }
    }

    // Always resolve with a document, including on network and parsing errors.
    // Otherwise the SDK either caches the error body or rejects without handling it.
    return Response.json(lastValidData);
  };

  return {
    requestHandler,
    cancelPending: () => {
      latestRequest++;
      bridge.cancelPending();
    },
  };
}
