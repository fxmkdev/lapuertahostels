import { act, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { StrictMode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

const initialData = {
  id: "page-one",
  hero: [{ id: "hero", text: "Initial hero" }],
  content: [{ id: "content", text: "Initial content" }],
};
const editedData = {
  ...initialData,
  content: [{ id: "content", text: "Edited content" }],
};

let i18n: ReturnType<typeof createInstance>;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  environment.preview = "pages/page-one";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: adminResources,
    react: { useSuspense: false },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Subject({
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

// Exercise the real Payload hook and subscription; only the HTTP boundary is mocked.
async function sendUpdate(
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

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("renders initial content and preserves Payload's request options for edits", async () => {
  render(<Subject />);
  expect(screen.getByRole("main")).toHaveTextContent("Initial content");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(Response.json(editedData));
  await sendUpdate();

  expect(screen.getByRole("main")).toHaveTextContent("Edited content");
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "https://cms.example.com/api/pages/page-one",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Payload-HTTP-Method-Override": "GET",
      },
      body: JSON.stringify({
        data: editedData,
        depth: 3,
        flattenLocales: false,
        locale: "en",
      }),
    },
  );
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
        ? "Sign back into the CMS and reopen live preview"
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
      "https://cms.example.com/api/pages/page-one",
      "https://cms.example.com/api/pages/page-one",
      "https://cms.example.com/api/pages/page-one",
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
  expect(fetchMock.mock.lastCall?.[0]).toBe(
    "https://cms.example.com/api/pages/page-two",
  );
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
    "Vuelve a iniciar sesión en el CMS",
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
    "https://cms.example.com/api/brands/page-one",
    "https://cms.example.com/api/brands/page-one",
  ]);
});
