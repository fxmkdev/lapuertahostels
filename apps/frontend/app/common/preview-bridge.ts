import {
  isPreviewResult,
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
  PREVIEW_REPLY_TIMEOUT,
} from "@lapuertahostels/live-preview";
import type { PreviewRequest } from "@lapuertahostels/live-preview";

export class PreviewConnectionError extends Error {}

export function createPreviewBridgeClient(
  documentPath: string,
  locale: string,
) {
  const pending = new Set<() => void>();

  function request(cmsURL: string, depth: number): Promise<Response> {
    const host =
      window.opener || (window.parent !== window ? window.parent : null);
    if (!host)
      return Promise.reject(
        new PreviewConnectionError("CMS window unavailable"),
      );
    const origin = new URL(cmsURL).origin;
    const requestId = crypto.randomUUID();
    const message: PreviewRequest = {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "populate",
      requestId,
      documentPath,
      locale,
      depth,
    };
    return waitForResult(host, origin, message, pending);
  }

  return {
    request,
    cancelPending: () => {
      for (const cancel of pending) cancel();
    },
  };
}

function waitForResult(
  host: Window,
  origin: string,
  message: PreviewRequest,
  pending: Set<() => void>,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      pending.delete(cancel);
    };
    const cancel = () => {
      finish();
      reject(new PreviewConnectionError("CMS preview connection interrupted"));
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== host ||
        event.origin !== origin ||
        !isPreviewResult(event.data) ||
        event.data.requestId !== message.requestId
      )
        return;
      finish();
      resolve(
        Response.json(
          event.data.status === 200 ? (event.data.data ?? null) : {},
          {
            status: event.data.status,
          },
        ),
      );
    };
    const timeout = setTimeout(cancel, PREVIEW_REPLY_TIMEOUT);
    pending.add(cancel);
    window.addEventListener("message", onMessage);
    try {
      host.postMessage(message, origin);
    } catch {
      cancel();
    }
  });
}
