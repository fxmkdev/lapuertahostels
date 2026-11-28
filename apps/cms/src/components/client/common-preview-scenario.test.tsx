import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CommonPreviewScenario } from "./common-preview-scenario";
import {
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
} from "@lapuertahostels/live-preview";

const state = vi.hoisted(() => ({
  document: { globalSlug: "common" },
  locale: { code: "en" },
  frame: { postMessage: vi.fn(), closed: false },
  popup: { postMessage: vi.fn(), closed: false },
  preview: {
    appIsReady: true,
    isLivePreviewing: true,
    isPopupOpen: false,
    previewWindowType: "iframe",
    url: "https://preview.example.com/en/preview/common",
    loadedURL: "",
    iframeRef: { current: null as unknown },
    popupRef: { current: null as unknown },
  },
}));
vi.mock("@payloadcms/ui", () => ({
  useDocumentInfo: () => state.document,
  useLocale: () => state.locale,
  useLivePreviewContext: () => state.preview,
}));
beforeEach(() => {
  state.document.globalSlug = "common";
  state.locale.code = "en";
  state.preview.appIsReady = true;
  state.preview.isLivePreviewing = true;
  state.preview.previewWindowType = "iframe";
  state.preview.url = "https://preview.example.com/en/preview/common";
  state.preview.iframeRef.current = { contentWindow: state.frame };
  state.preview.popupRef.current = state.popup;
  state.frame.closed = false;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("sends the active tab on opening and on later tab changes", () => {
  state.preview.appIsReady = false;
  const view = render(
    <CommonPreviewScenario
      scenario="notFound"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.frame.postMessage).not.toHaveBeenCalled();
  state.preview.appIsReady = true;
  view.rerender(
    <CommonPreviewScenario
      scenario="notFound"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.frame.postMessage).toHaveBeenLastCalledWith(
    {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_VERSION,
      type: "scenario",
      documentPath: "globals/common",
      locale: "en",
      scenario: "notFound",
    },
    "https://preview.example.com",
  );
  view.rerender(
    <CommonPreviewScenario
      scenario="notFound"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.frame.postMessage).toHaveBeenCalledOnce();
  view.rerender(
    <CommonPreviewScenario
      scenario="serverError"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.frame.postMessage.mock.lastCall?.[0].scenario).toBe(
    "serverError",
  );
});

test("uses the restored tab and resends after locale or preview-window changes", () => {
  const view = render(
    <CommonPreviewScenario
      scenario="serverError"
      previewOrigin="https://preview.example.com"
    />,
  );
  state.locale.code = "es";
  view.rerender(
    <CommonPreviewScenario
      scenario="serverError"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.frame.postMessage.mock.lastCall?.[0]).toMatchObject({
    locale: "es",
    scenario: "serverError",
  });
  state.preview.previewWindowType = "popup";
  view.rerender(
    <CommonPreviewScenario
      scenario="serverError"
      previewOrigin="https://preview.example.com"
    />,
  );
  expect(state.popup.postMessage.mock.lastCall?.[0]).toMatchObject({
    locale: "es",
    scenario: "serverError",
  });
});

test.each(["inactive", "other global", "wrong origin", "closed"])(
  "does not send to an %s preview",
  (reason) => {
    if (reason === "inactive") state.preview.isLivePreviewing = false;
    if (reason === "other global") state.document.globalSlug = "footer";
    if (reason === "wrong origin")
      state.preview.url = "https://other.example.com/page";
    if (reason === "closed") state.frame.closed = true;
    render(
      <CommonPreviewScenario
        scenario="notFound"
        previewOrigin="https://preview.example.com"
      />,
    );
    expect(state.frame.postMessage).not.toHaveBeenCalled();
    expect(state.popup.postMessage).not.toHaveBeenCalled();
  },
);
