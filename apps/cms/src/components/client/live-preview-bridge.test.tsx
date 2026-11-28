import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LivePreviewBridge } from "./live-preview-bridge";

const state = vi.hoisted(() => ({
  document: {
    id: "page-one" as string | undefined,
    collectionSlug: "pages" as string | undefined,
    globalSlug: undefined as string | undefined,
  },
  locale: { code: "en" },
  preview: {
    isLivePreviewing: true,
    previewWindowType: "iframe",
    url: "https://preview.example.com/page",
    loadedURL: "https://preview.example.com/page",
    iframeRef: { current: { contentWindow: {} } },
    popupRef: { current: {} },
  },
  listen: vi.fn(),
  stop: vi.fn(),
  getData: vi.fn(),
}));
vi.mock("@payloadcms/ui", () => ({
  useDocumentInfo: () => state.document,
  useLocale: () => state.locale,
  useLivePreviewContext: () => state.preview,
  useForm: () => ({ getData: state.getData }),
  useConfig: () => ({ config: { routes: { api: "/api" } } }),
}));
vi.mock("./preview-bridge-handler", () => ({
  listenForPreviewRequests: state.listen,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.preview.previewWindowType = "iframe";
  state.document = {
    id: "page-one",
    collectionSlug: "pages",
    globalSlug: undefined,
  };
});

test.each(["iframe", "popup"])(
  "connects only the active %s and cleans up when its locale changes",
  (type) => {
    state.listen.mockReturnValue(state.stop);
    state.locale.code = "en";
    state.preview.previewWindowType = type;
    const view = render(
      <LivePreviewBridge previewOrigin="https://preview.example.com" />,
    );
    const getContext = state.listen.mock.lastCall?.[1];
    expect(getContext()).toMatchObject({
      previewWindow:
        type === "iframe"
          ? state.preview.iframeRef.current.contentWindow
          : state.preview.popupRef.current,
      documentPath: "pages/page-one",
      locale: "en",
      getData: state.getData,
    });
    state.locale.code = "es";
    view.rerender(
      <LivePreviewBridge previewOrigin="https://preview.example.com" />,
    );
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.listen.mock.lastCall?.[1]().locale).toBe("es");
    view.unmount();
    expect(state.stop).toHaveBeenCalledTimes(2);
  },
);

test("does not install a bridge for an unconfigured preview origin", () => {
  render(<LivePreviewBridge previewOrigin="https://other.example.com" />);
  expect(state.listen).not.toHaveBeenCalled();
});

test.each(["footer", "common"])(
  "connects the %s global without a collection ID",
  (slug) => {
    state.listen.mockReturnValue(state.stop);
    state.document = {
      id: undefined,
      collectionSlug: undefined,
      globalSlug: slug,
    };
    render(<LivePreviewBridge previewOrigin="https://preview.example.com" />);
    expect(state.listen.mock.lastCall?.[1]()).toMatchObject({
      documentPath: `globals/${slug}`,
      id: undefined,
    });
  },
);

test("connects banners and rejects globals outside the preview allowlist", () => {
  state.listen.mockReturnValue(state.stop);
  state.document = {
    id: "banner-one",
    collectionSlug: "banners",
    globalSlug: undefined,
  };
  const view = render(
    <LivePreviewBridge previewOrigin="https://preview.example.com" />,
  );
  expect(state.listen.mock.lastCall?.[1]().documentPath).toBe(
    "banners/banner-one",
  );
  state.listen.mockClear();
  state.document = {
    id: undefined,
    collectionSlug: undefined,
    globalSlug: "settings",
  };
  view.rerender(
    <LivePreviewBridge previewOrigin="https://preview.example.com" />,
  );
  expect(state.listen).not.toHaveBeenCalled();
});
