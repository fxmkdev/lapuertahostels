import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { I18nextProvider } from "react-i18next";
import { expect, test, vi } from "vitest";
import {
  PREVIEW_CHANNEL,
  PREVIEW_VERSION,
} from "@lapuertahostels/live-preview";
import { environment, host, i18n } from "./live-preview.test-helpers";
import { useCommonPreviewScenario } from "./use-common-preview-scenario";

function Probe() {
  const { scenario, setScenario } = useCommonPreviewScenario();
  const location = useLocation();
  return (
    <>
      <output data-testid="scenario">{scenario}</output>
      <output data-testid="search">{location.search}</output>
      <button onClick={() => setScenario("notFound")}>Manual</button>
    </>
  );
}
function subject(value: string | null = "notFound") {
  environment.preview = "globals/common";
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter
        initialEntries={[
          `/en/preview/common?preview=globals/common&lng=en&skipcache=true${value === null ? "" : `&scenario=${value}`}`,
        ]}
      >
        <Probe />
      </MemoryRouter>
    </I18nextProvider>,
  );
}
const valid = {
  channel: PREVIEW_CHANNEL,
  version: PREVIEW_VERSION,
  type: "scenario",
  documentPath: "globals/common",
  locale: "en",
  scenario: "serverError",
};
function send(
  data: unknown = valid,
  origin = environment.payloadCmsBaseUrl,
  source: unknown = host,
) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", { data, origin, source: source as Window }),
    ),
  );
}

test("trusted CMS tab messages update the URL while manual selection remains independent", () => {
  subject();
  send();
  expect(screen.getByTestId("scenario")).toHaveTextContent("serverError");
  expect(
    Object.fromEntries(
      new URLSearchParams(screen.getByTestId("search").textContent!),
    ),
  ).toEqual({
    preview: "globals/common",
    lng: "en",
    skipcache: "true",
    scenario: "serverError",
  });
  fireEvent.click(screen.getByRole("button", { name: "Manual" }));
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
  send();
  expect(screen.getByTestId("scenario")).toHaveTextContent("serverError");
});

test.each([
  null,
  [],
  { ...valid, version: 2 },
  { ...valid, type: "populate" },
  { ...valid, documentPath: "globals/footer" },
  { ...valid, locale: "es" },
  { ...valid, scenario: "labels" },
])("rejects invalid or unrelated scenario message %j", (message) => {
  subject();
  send(message);
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
});

test("rejects a forged origin or source window", () => {
  subject();
  send(valid, "https://attacker.example.com");
  send(valid, environment.payloadCmsBaseUrl, {});
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
});

test.each(["labels", "unknown"])(
  "normalizes the removed or invalid %s scenario",
  (value) => {
    subject(value);
    expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
    expect(screen.getByTestId("search")).toHaveTextContent("scenario=notFound");
  },
);

test("ignores old-locale messages after the content language changes", async () => {
  subject();
  await act(() => i18n.changeLanguage("es"));
  send();
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
  send({ ...valid, locale: "es" });
  expect(screen.getByTestId("scenario")).toHaveTextContent("serverError");
});

test("does not accept a scenario without an active CMS parent or opener", () => {
  vi.stubGlobal("opener", null);
  subject();
  send(valid, environment.payloadCmsBaseUrl, null);
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
});

test("a fresh preview without an error-tab notification defaults to Page not found", () => {
  subject(null);
  expect(screen.getByTestId("scenario")).toHaveTextContent("notFound");
});
