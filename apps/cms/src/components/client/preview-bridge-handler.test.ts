import {
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
  PREVIEW_FETCH_TIMEOUT,
} from "@lapuertahostels/live-preview";
import type { PreviewRequest } from "@lapuertahostels/live-preview";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { listenForPreviewRequests } from "./preview-bridge-handler";
import type { PreviewContext } from "./preview-bridge-handler";

const origin = "https://preview.example.com";
const previewWindow = { postMessage: vi.fn() };
const fetchMock = vi.fn<typeof fetch>();
let context: PreviewContext | null;
let formData: Record<string, unknown>;
let dispose: () => void;
const request: PreviewRequest = {
  channel: PREVIEW_CHANNEL,
  version: PREVIEW_VERSION,
  type: "populate",
  requestId: "request-one",
  documentPath: "pages/page-one",
  locale: "en",
  depth: 3,
};

beforeEach(() => {
  previewWindow.postMessage.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  formData = { content: [{ text: "Unsaved CMS content" }] };
  context = {
    previewWindow: previewWindow as unknown as Window,
    documentPath: request.documentPath,
    id: "page-one",
    locale: "en",
    apiRoute: "/api",
    getData: () => formData,
  };
  dispose = listenForPreviewRequests(origin, () => context);
});
afterEach(() => {
  dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function send(
  data: unknown = request,
  eventOrigin = origin,
  source: unknown = previewWindow,
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: eventOrigin,
      source: source as Window,
      data,
    }),
  );
}

test("populates the latest CMS form on its own origin and returns only the document", async () => {
  formData = {
    id: "untrusted-form-id",
    content: [{ text: "Newest unsaved content" }],
  };
  const document = { id: context!.id, content: formData.content };
  fetchMock.mockResolvedValueOnce(
    Response.json(document, { headers: { "Set-Cookie": "secret" } }),
  );
  send({
    ...request,
    data: { content: "Ignore preview-supplied content" },
    url: "https://attacker.example",
  });
  await vi.waitFor(() =>
    expect(previewWindow.postMessage).toHaveBeenCalledOnce(),
  );
  expect(fetchMock).toHaveBeenCalledWith("/api/pages/page-one", {
    method: "POST",
    credentials: "same-origin",
    redirect: "error",
    signal: expect.any(AbortSignal),
    headers: {
      "Content-Type": "application/json",
      "X-Payload-HTTP-Method-Override": "GET",
    },
    body: JSON.stringify({
      data: { ...formData, id: context!.id },
      depth: 3,
      flattenLocales: false,
      locale: "en",
    }),
  });
  expect(previewWindow.postMessage).toHaveBeenCalledWith(
    {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "result",
      requestId: request.requestId,
      status: 200,
      data: document,
    },
    origin,
  );
});

const invalidRequests = [
  null,
  [],
  {},
  { ...request, version: 2 },
  { ...request, channel: "other" },
  { ...request, type: "result" },
  { ...request, requestId: "" },
  { ...request, documentPath: "pages/another-page" },
  { ...request, documentPath: "users/page-one" },
  { ...request, documentPath: "pages/../users" },
  { ...request, locale: "es" },
  ...[-1, 4, 1.5, "3", null].map((depth) => ({ ...request, depth })),
];
test.each(invalidRequests.map((data, index) => ({ data, index })))(
  "rejects invalid or out-of-context request $index",
  ({ data }) => {
    send(data);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(previewWindow.postMessage).not.toHaveBeenCalled();
  },
);

test("ignores requests from other origins, windows, or inactive previews", () => {
  send(request, "https://attacker.example.com");
  send(request, origin, {});
  context = null;
  send();
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([401, 403, 500])(
  "returns status %i without server error details",
  async (status) => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { errors: [{ stack: "private server details" }] },
        { status },
      ),
    );
    send();
    await vi.waitFor(() =>
      expect(previewWindow.postMessage).toHaveBeenCalledOnce(),
    );
    expect(previewWindow.postMessage.mock.lastCall?.[0]).toEqual({
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "result",
      requestId: request.requestId,
      status,
    });
  },
);

test.each([
  () => new Response("invalid json"),
  () => Response.json({ id: "another-page" }),
  () =>
    Response.json({ id: "page-one", errors: [{ stack: "private details" }] }),
  () => Promise.reject(new Error("private network details")),
])("sanitizes malformed documents and network failures", async (response) => {
  fetchMock.mockImplementationOnce(async () => response());
  send();
  await vi.waitFor(() =>
    expect(previewWindow.postMessage).toHaveBeenCalledOnce(),
  );
  expect(previewWindow.postMessage.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({ status: 502 }),
  );
  expect(previewWindow.postMessage.mock.lastCall?.[0]).not.toHaveProperty(
    "data",
  );
});

function pendingFetch() {
  fetchMock.mockImplementationOnce(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
}

test("aborts CMS requests at the deadline and reports a timeout", async () => {
  vi.useFakeTimers();
  pendingFetch();
  send();
  await vi.advanceTimersByTimeAsync(PREVIEW_FETCH_TIMEOUT);
  expect(fetchMock.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
  expect(previewWindow.postMessage.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({ status: 504 }),
  );
});

test("disposal aborts requests and removes the listener without sending stale replies", async () => {
  pendingFetch();
  send();
  dispose();
  await Promise.resolve();
  await Promise.resolve();
  expect(fetchMock.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
  send();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(previewWindow.postMessage).not.toHaveBeenCalled();
});

test.each(["document", "locale", "window"])(
  "does not send an old result after the active %s changes",
  async (change) => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    send();
    context = {
      ...context!,
      ...(change === "document"
        ? { documentPath: "pages/other" }
        : change === "locale"
          ? { locale: "es" }
          : { previewWindow: {} as Window }),
    };
    resolve(Response.json({ id: "page-one" }));
    await new Promise((done) => setTimeout(done, 0));
    expect(previewWindow.postMessage).not.toHaveBeenCalled();
  },
);

test("supports brand documents and valid empty arrays", async () => {
  context = { ...context!, documentPath: "brands/puerta", id: "puerta" };
  fetchMock.mockResolvedValueOnce(Response.json({ id: "puerta", content: [] }));
  send({ ...request, documentPath: "brands/puerta", depth: 0 });
  await vi.waitFor(() =>
    expect(previewWindow.postMessage).toHaveBeenCalledOnce(),
  );
  expect(fetchMock.mock.lastCall?.[0]).toBe("/api/brands/puerta");
  expect(previewWindow.postMessage.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({
      status: 200,
      data: { id: "puerta", content: [] },
    }),
  );
});
