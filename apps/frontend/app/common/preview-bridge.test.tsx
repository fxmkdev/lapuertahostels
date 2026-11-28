import { act, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  isPreviewRequest,
  PREVIEW_CHANNEL,
  PREVIEW_REPLY_TIMEOUT,
} from "@lapuertahostels/live-preview";
import {
  environment,
  editedData,
  host,
  reply,
  Subject,
  sendUpdate,
} from "./live-preview.test-helpers";

test("ignores forged results and times out without overwriting content", async () => {
  vi.useFakeTimers();
  host.postMessage.mockImplementation(() => {});
  render(<Subject />);
  await sendUpdate();
  const request = host.postMessage.mock.calls
    .map(([message]) => message)
    .find(isPreviewRequest)!;
  await act(async () => {
    reply(request, 200, editedData, "https://attacker.example.com");
    reply(request, 200, editedData, environment.payloadCmsBaseUrl, {});
    reply({ ...request, requestId: "wrong-id" }, 200, editedData);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: environment.payloadCmsBaseUrl,
        source: host as unknown as Window,
        data: {
          channel: PREVIEW_CHANNEL,
          version: 2,
          type: "result",
          requestId: request.requestId,
          status: 200,
          data: editedData,
        },
      }),
    );
  });
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PREVIEW_REPLY_TIMEOUT);
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not connect to the CMS",
  );
  await act(async () => {
    reply(request, 200, editedData);
  });
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  host.postMessage.mockImplementation((message: unknown) => {
    if (isPreviewRequest(message)) reply(message, 200, editedData);
  });
  await sendUpdate();
  expect(screen.getByRole("main")).toHaveTextContent("Edited content");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("reports an unavailable parent window without making HTTP requests", async () => {
  vi.stubGlobal("opener", null);
  render(<Subject />);
  await sendUpdate();
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Reopen live preview from the CMS",
  );
  expect(window.fetch).not.toHaveBeenCalled();
});

test("cleans up outstanding bridge requests when the preview unmounts", async () => {
  vi.useFakeTimers();
  host.postMessage.mockImplementation(() => {});
  const view = render(<Subject />);
  await sendUpdate();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  await act(async () => {
    view.unmount();
  });
  expect(vi.getTimerCount()).toBe(0);
});
