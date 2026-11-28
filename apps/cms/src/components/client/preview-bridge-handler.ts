import {
  isPreviewDocument,
  isPreviewRequest,
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
  PREVIEW_FETCH_TIMEOUT,
} from "@lapuertahostels/live-preview";
import type {
  PreviewRequest,
  PreviewResult,
} from "@lapuertahostels/live-preview";

export type PreviewContext = {
  previewWindow: Window;
  documentPath: string;
  id?: string | number;
  locale: string;
  apiRoute: string;
  getData: () => Record<string, unknown>;
};

async function populate(
  context: PreviewContext,
  request: PreviewRequest,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${context.apiRoute}/${context.documentPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Payload-HTTP-Method-Override": "GET",
      },
      body: JSON.stringify({
        data: {
          ...context.getData(),
          ...(context.id === undefined ? {} : { id: context.id }),
        },
        depth: request.depth,
        flattenLocales: false,
        locale: context.locale,
      }),
    },
  );
  if (!response.ok)
    return { status: response.status >= 400 ? response.status : 502 };
  const data: unknown = await response.json();
  return isPreviewDocument(data, context.id)
    ? { status: 200, data }
    : { status: 502 };
}

async function populateWithTimeout(
  context: PreviewContext,
  request: PreviewRequest,
  controller: AbortController,
): Promise<Pick<PreviewResult, "status" | "data">> {
  const timeout = setTimeout(() => controller.abort(), PREVIEW_FETCH_TIMEOUT);
  try {
    return await populate(context, request, controller.signal);
  } catch {
    return { status: controller.signal.aborted ? 504 : 502 };
  } finally {
    clearTimeout(timeout);
  }
}

export function listenForPreviewRequests(
  previewOrigin: string,
  getContext: () => PreviewContext | null,
) {
  const pending = new Set<AbortController>();
  let disposed = false;

  async function reply(context: PreviewContext, request: PreviewRequest) {
    const controller = new AbortController();
    pending.add(controller);
    const result = await populateWithTimeout(context, request, controller);
    pending.delete(controller);
    const current = getContext();
    if (
      disposed ||
      current?.previewWindow !== context.previewWindow ||
      current.documentPath !== context.documentPath ||
      current.locale !== context.locale
    )
      return;
    const message: PreviewResult = {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "result",
      requestId: request.requestId,
      ...result,
    };
    context.previewWindow.postMessage(message, previewOrigin);
  }

  function onMessage(event: MessageEvent<unknown>) {
    const context = getContext();
    if (
      !context ||
      event.origin !== previewOrigin ||
      event.source !== context.previewWindow ||
      !isPreviewRequest(event.data) ||
      event.data.documentPath !== context.documentPath ||
      event.data.locale !== context.locale
    )
      return;
    void reply(context, event.data);
  }

  window.addEventListener("message", onMessage);
  return () => {
    disposed = true;
    window.removeEventListener("message", onMessage);
    for (const controller of pending) controller.abort();
  };
}
