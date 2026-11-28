import type { useLivePreview } from "@payloadcms/live-preview-react";

type RequestHandler = NonNullable<
  Parameters<typeof useLivePreview>[0]["requestHandler"]
>;

function isExpectedDocument(document: unknown, expectedId: unknown) {
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

function fetchPreview(
  documentPath: string,
  { apiPath, data, serverURL }: Parameters<RequestHandler>[0],
) {
  // Payload shares a document cache across subscriptions. Use our document
  // path so a delayed response from an old subscription cannot change it.
  return fetch(`${serverURL}${apiPath}/${encodeURI(documentPath)}`, {
    body: JSON.stringify(data),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Payload-HTTP-Method-Override": "GET",
    },
    method: "POST",
  });
}

export type PreviewSnapshot<T> = {
  data: T;
  error: "authentication" | "request" | null;
};

export function createPreviewRequestHandler<T>({
  initialData,
  documentPath,
  onChange,
}: {
  initialData: T;
  documentPath: string;
  onChange: (snapshot: PreviewSnapshot<T>) => void;
}) {
  let lastValidData = initialData;
  let latestRequest = 0;
  const expectedId = (initialData as { id?: unknown }).id;

  const requestHandler: RequestHandler = async (args) => {
    const request = ++latestRequest;
    let error: PreviewSnapshot<T>["error"] = "request";

    try {
      const response = await fetchPreview(documentPath, args);

      if (response.status === 401 || response.status === 403) {
        error = "authentication";
      }
      if (!response.ok) throw new Error("Preview request failed");

      const document: unknown = await response.json();
      if (!isExpectedDocument(document, expectedId)) {
        throw new Error("Invalid preview document");
      }

      if (request === latestRequest) {
        lastValidData = document as T;
        onChange({ data: lastValidData, error: null });
      }
    } catch {
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
    },
  };
}
