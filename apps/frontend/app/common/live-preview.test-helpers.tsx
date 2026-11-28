import {
  isPreviewRequest,
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
} from "@lapuertahostels/live-preview";
import type { PreviewRequest } from "@lapuertahostels/live-preview";
import { act } from "@testing-library/react";
import { createInstance } from "i18next";
import { StrictMode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, beforeEach, vi } from "vitest";
import { adminResources } from "~/i18n.admin-resources";
import { OptInLivePreview } from "./live-preview";

const { environment } = vi.hoisted(() => ({
  environment: {
    payloadCmsBaseUrl: "https://cms.example.com",
    preview: "pages/page-one",
  },
}));

vi.mock("~/common/environment", () => ({
  useEnvironment: () => environment,
}));

export const initialData = {
  id: "page-one",
  hero: [{ id: "hero", text: "Initial hero" }],
  content: [{ id: "content", text: "Initial content" }],
};
export const editedData = {
  ...initialData,
  content: [{ id: "content", text: "Edited content" }],
};

export let i18n: ReturnType<typeof createInstance>;
// Simulates CMS-side population. The frontend itself must never call fetch.
export const fetchMock =
  vi.fn<(path: string, message: PreviewRequest) => Promise<Response>>();
export const host = { postMessage: vi.fn() };
export function reply(
  request: PreviewRequest,
  status: number,
  data?: unknown,
  origin = environment.payloadCmsBaseUrl,
  source: unknown = host,
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      source: source as Window,
      data: {
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_VERSION,
        type: "result",
        requestId: request.requestId,
        status,
        data,
      },
    }),
  );
}

beforeEach(async () => {
  environment.preview = "pages/page-one";
  fetchMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Frontend must not fetch the CMS directly");
    }),
  );
  vi.stubGlobal("opener", host);
  host.postMessage.mockReset();
  host.postMessage.mockImplementation((message: unknown) => {
    if (!isPreviewRequest(message)) return;
    void (async () => {
      try {
        const response = await fetchMock(message.documentPath, message);
        reply(
          message,
          response.ok ? 200 : response.status,
          response.ok ? await response.json() : undefined,
        );
      } catch {
        reply(message, 502);
      }
    })();
  });
  i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: adminResources,
    react: { useSuspense: false },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

export function Subject({
  data = initialData,
  path = `pages/${data.id}`,
}: {
  data?: typeof initialData;
  path?: string;
}) {
  return (
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <OptInLivePreview path={path} data={data} depth={3}>
          {(page) => (
            <main>
              {page.hero?.map((block) => (
                <h1 key={block.id}>{block.text}</h1>
              ))}
              {page.content?.map((block) => (
                <p key={block.id}>{block.text}</p>
              ))}
            </main>
          )}
        </OptInLivePreview>
      </I18nextProvider>
    </StrictMode>
  );
}

// Exercise the real Payload hook and bridge client; simulate only the CMS window.
export async function sendUpdate(
  data = editedData,
  locale = "en",
  collectionSlug = "pages",
) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: environment.payloadCmsBaseUrl,
        data: {
          type: "payload-live-preview",
          collectionSlug,
          data,
          locale,
        },
      }),
    );
  });
}

export function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

export { environment };
