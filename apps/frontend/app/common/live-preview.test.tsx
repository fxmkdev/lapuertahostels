import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
} from "@lapuertahostels/live-preview";
import {
  environment,
  initialData,
  editedData,
  i18n,
  fetchMock,
  host,
  Subject,
  sendUpdate,
  deferredResponse,
} from "./live-preview.test-helpers";

test("renders initial content and requests population through the CMS window", async () => {
  render(<Subject />);
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(Response.json(editedData));
  await sendUpdate();
  expect(screen.getByRole("main")).toHaveTextContent("Edited content");
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("pages/page-one", {
    channel: PREVIEW_CHANNEL,
    version: PREVIEW_VERSION,
    type: "populate",
    requestId: expect.any(String),
    documentPath: "pages/page-one",
    depth: 3,
    locale: "en",
  });
  expect(host.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "populate" }),
    environment.payloadCmsBaseUrl,
  );
  expect(window.fetch).not.toHaveBeenCalled();
});

const failures = [
  ...[401, 403, 500].map((status) => ({
    name: `HTTP ${status}`,
    response: () =>
      Response.json({ errors: [{ message: "Failed" }] }, { status }),
    authentication: status !== 500,
  })),
  { name: "invalid JSON", response: () => new Response("<html>Error</html>") },
  { name: "missing ID", response: () => Response.json({}) },
  {
    name: "wrong ID",
    response: () => Response.json({ ...editedData, id: "other" }),
  },
  { name: "null document", response: () => Response.json(null) },
  { name: "array document", response: () => Response.json([]) },
  {
    name: "error envelope with matching ID",
    response: () => Response.json({ id: initialData.id, errors: [] }),
  },
  {
    name: "network rejection",
    response: () => Promise.reject(new TypeError("Failed to fetch")),
  },
];

test.each(failures)(
  "retains the latest content and recovers after $name",
  async (failure) => {
    render(<Subject />);
    fetchMock.mockResolvedValueOnce(Response.json(editedData));
    await sendUpdate();
    expect(screen.getByRole("main")).toHaveTextContent("Edited content");

    fetchMock.mockImplementationOnce(async () => failure.response());
    await sendUpdate();
    expect(screen.getByRole("main")).toHaveTextContent("Edited content");
    expect(screen.getByRole("heading")).toHaveTextContent("Initial hero");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "authentication" in failure && failure.authentication
        ? "Check your CMS session and access, then reopen live preview"
        : "Try editing again or reload the preview",
    );

    const recoveredData = {
      ...initialData,
      content: [{ id: "content", text: "Recovered content" }],
    };
    fetchMock.mockResolvedValueOnce(Response.json(recoveredData));
    await sendUpdate(recoveredData);
    expect(screen.getByRole("main")).toHaveTextContent("Recovered content");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "pages/page-one",
      "pages/page-one",
      "pages/page-one",
    ]);
  },
);

test("shows an error without losing the initial content when the first update fails", async () => {
  render(<Subject />);
  fetchMock.mockResolvedValueOnce(
    Response.json({ errors: [] }, { status: 403 }),
  );
  await sendUpdate();
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("accepts intentional removal of every block", async () => {
  render(<Subject />);
  const emptyData = { ...initialData, hero: [], content: [] };
  fetchMock.mockResolvedValueOnce(Response.json(emptyData));
  await sendUpdate(emptyData);
  expect(screen.getByRole("main")).toBeEmptyDOMElement();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test.each(["success", "failure"])(
  "ignores an older %s after a newer successful update",
  async (result) => {
    render(<Subject />);
    const older = deferredResponse();
    fetchMock.mockReturnValueOnce(older.promise);
    await sendUpdate(initialData);
    fetchMock.mockResolvedValueOnce(Response.json(editedData));
    await sendUpdate();

    await act(async () => {
      older.resolve(
        result === "success"
          ? Response.json(initialData)
          : Response.json({ errors: [] }, { status: 403 }),
      );
    });
    expect(screen.getByRole("main")).toHaveTextContent("Edited content");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

test("an older success cannot clear the newest error or apply superseded content", async () => {
  render(<Subject />);
  const older = deferredResponse();
  fetchMock.mockReturnValueOnce(older.promise);
  await sendUpdate();
  fetchMock.mockResolvedValueOnce(
    Response.json({ errors: [] }, { status: 500 }),
  );
  await sendUpdate();

  await act(async () => older.resolve(Response.json(editedData)));
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("switching documents resets the snapshot and ignores requests from the old document", async () => {
  const view = render(<Subject />);
  fetchMock.mockResolvedValueOnce(
    Response.json({ errors: [] }, { status: 403 }),
  );
  await sendUpdate();
  const older = deferredResponse();
  fetchMock.mockReturnValueOnce(older.promise);
  await sendUpdate();

  const nextData = {
    ...initialData,
    id: "page-two",
    content: [{ id: "content", text: "Second page" }],
  };
  environment.preview = "pages/page-two";
  view.rerender(<Subject data={nextData} />);
  expect(screen.getByRole("main")).toHaveTextContent("Second page");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await act(async () => older.resolve(Response.json(editedData)));
  expect(screen.getByRole("main")).toHaveTextContent("Second page");

  fetchMock.mockResolvedValueOnce(Response.json(nextData));
  await sendUpdate(nextData);
  expect(fetchMock.mock.lastCall?.[0]).toBe("pages/page-two");
  expect(screen.getByRole("main")).toHaveTextContent("Second page");
});

test("switching languages resets retained content and translates the error", async () => {
  render(<Subject />);
  const older = deferredResponse();
  fetchMock.mockReturnValueOnce(older.promise);
  await sendUpdate();
  await act(async () => {
    await i18n.changeLanguage("es");
  });
  await act(async () => older.resolve(Response.json(editedData)));
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");

  fetchMock.mockResolvedValueOnce(
    Response.json({ errors: [] }, { status: 403 }),
  );
  await sendUpdate(initialData, "es");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Comprueba tu sesión y tus permisos en el CMS",
  );
  const spanishData = {
    ...initialData,
    content: [{ id: "content", text: "Contenido actualizado" }],
  };
  fetchMock.mockResolvedValueOnce(Response.json(spanishData));
  await sendUpdate(spanishData, "es");
  expect(screen.getByRole("main")).toHaveTextContent("Contenido actualizado");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("ordinary pages do not subscribe to live preview", async () => {
  environment.preview = "pages/other-page";
  render(<Subject />);
  await sendUpdate();
  await waitFor(() =>
    expect(screen.getByRole("main")).toHaveTextContent("Initial content"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("brand previews retain their content on failure and recover on the brand endpoint", async () => {
  environment.preview = "brands/page-one";
  render(<Subject path="brands/page-one" />);
  fetchMock.mockResolvedValueOnce(
    Response.json({ errors: [] }, { status: 403 }),
  );
  await sendUpdate(editedData, "en", "brands");
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.getByRole("alert")).toBeInTheDocument();

  fetchMock.mockResolvedValueOnce(Response.json(editedData));
  await sendUpdate(editedData, "en", "brands");
  expect(screen.getByRole("main")).toHaveTextContent("Edited content");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "brands/page-one",
    "brands/page-one",
  ]);
});

test.each(["banners/banner-one", "globals/footer", "globals/common"])(
  "previews %s through the authenticated bridge",
  async (path) => {
    environment.preview = path;
    const data = { ...initialData, id: path.split("/")[1] };
    render(<Subject path={path} data={data} />);
    const updated = {
      ...data,
      content: [{ id: "content", text: "Unsaved global or banner" }],
    };
    // Globals need no collection-document ID in the population response.
    const response = path.startsWith("globals/")
      ? { ...updated, id: undefined }
      : updated;
    fetchMock.mockResolvedValueOnce(Response.json(response));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: environment.payloadCmsBaseUrl,
          data: {
            type: "payload-live-preview",
            data: updated,
            locale: "en",
            ...(path.startsWith("globals/")
              ? { globalSlug: path.split("/")[1] }
              : { collectionSlug: "banners" }),
          },
        }),
      );
    });
    expect(screen.getByRole("main")).toHaveTextContent(
      "Unsaved global or banner",
    );
    expect(fetchMock.mock.lastCall?.[0]).toBe(path);
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 403 }));
    await sendUpdate(data, "en", "banners");
    expect(screen.getByRole("main")).toHaveTextContent(
      "Unsaved global or banner",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check your CMS session",
    );
  },
);
