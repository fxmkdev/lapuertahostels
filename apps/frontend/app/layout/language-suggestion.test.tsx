import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  LanguageSuggestion,
  LanguageOfferArrivalProvider,
  isLanguageOfferArrival,
} from "./language-suggestion";
import type { LanguageSuggestion as Suggestion } from "~/language-suggestion";

vi.mock("~/common/button", () => ({
  Button: ({
    children,
    type,
  }: {
    children: React.ReactNode;
    type: "submit";
  }) => <button type={type}>{children}</button>,
}));

const suggestion: Suggestion = {
  locale: "es",
  pathname: "/azul/contacto",
  message: "Esta página también está disponible en Español.",
  switch: "Cambiar a Español",
  keep: "Continuar en English",
};
const originalEntries = Object.getOwnPropertyDescriptor(
  performance,
  "getEntriesByType",
);

beforeEach(() => {
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "",
  });
  Object.defineProperty(performance, "getEntriesByType", {
    configurable: true,
    value: () => [{ type: "navigate" }],
  });
});
afterEach(() => {
  if (originalEntries)
    Object.defineProperty(performance, "getEntriesByType", originalEntries);
  else Reflect.deleteProperty(performance, "getEntriesByType");
});

function router() {
  return createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <LanguageOfferArrivalProvider>
            <LanguageSuggestion suggestion={suggestion} />
          </LanguageOfferArrivalProvider>
        ),
      },
    ],
    {
      initialEntries: [
        "/en/azul/contact?campaign=friend&tag=a&tag=b#directions",
      ],
    },
  );
}

test.each([
  ["", "navigate", true],
  ["https://external.example/post", "navigate", true],
  ["https://example.com/en", "navigate", false],
  ["", "reload", false],
  ["https://external.example/post", "back_forward", false],
  ["invalid", "navigate", false],
])("arrival eligibility for %s and %s", (referrer, navigation, eligible) => {
  expect(
    isLanguageOfferArrival(referrer, "https://example.com", navigation),
  ).toBe(eligible);
});

test("hydrates without a server-side notice and preserves full form destinations", () => {
  const navigation = router();
  const html = renderToString(<RouterProvider router={navigation} />);
  expect(html).not.toContain("<aside");
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const onRecoverableError = vi.fn();
  render(<RouterProvider router={navigation} />, {
    container,
    hydrate: true,
    onRecoverableError,
  });
  const notice = screen.getByRole("complementary", {
    name: suggestion.message,
  });
  expect(notice).toHaveAttribute("lang", "es");
  const switchForm = screen
    .getByRole("button", { name: suggestion.switch })
    .closest("form")!;
  const keepForm = screen
    .getByRole("button", { name: suggestion.keep })
    .closest("form")!;
  expect(switchForm).toHaveAttribute("action", "/locale");
  expect(switchForm).toHaveAttribute("method", "post");
  expect(Object.fromEntries(new FormData(switchForm))).toEqual({
    locale: "es",
    redirectTo: "/azul/contacto?campaign=friend&tag=a&tag=b#directions",
  });
  expect(Object.fromEntries(new FormData(keepForm))).toEqual({
    locale: "en",
    redirectTo: "/azul/contact?campaign=friend&tag=a&tag=b#directions",
  });
  expect(document.activeElement).toBe(document.body);
  expect(onRecoverableError).not.toHaveBeenCalled();
});

test("clears on client navigation and never rearms on back navigation", async () => {
  const navigation = router();
  render(<RouterProvider router={navigation} />);
  expect(screen.getByRole("complementary")).toBeVisible();
  await act(() => navigation.navigate("/en/another"));
  expect(screen.queryByRole("complementary")).toBeNull();
  await act(() => navigation.navigate(-1));
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("can receive the initial page's suggestion after the document hydrates", () => {
  function Subject() {
    const [available, setAvailable] = useState(false);
    return (
      <LanguageOfferArrivalProvider>
        <button onClick={() => setAvailable(true)}>Load suggestion</button>
        <LanguageSuggestion suggestion={available ? suggestion : undefined} />
      </LanguageOfferArrivalProvider>
    );
  }
  const navigation = createMemoryRouter([{ path: "*", element: <Subject /> }], {
    initialEntries: ["/en/contact"],
  });
  render(<RouterProvider router={navigation} />);
  expect(screen.queryByRole("complementary")).toBeNull();
  act(() => screen.getByRole("button", { name: "Load suggestion" }).click());
  expect(screen.getByRole("complementary")).toBeVisible();
});

test("clears when leaving a document, including a bfcache departure", () => {
  render(<RouterProvider router={router()} />);
  act(() => window.dispatchEvent(new Event("pagehide")));
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("does not rearm when the notice remounts after a screen error", async () => {
  const navigation = createMemoryRouter(
    [
      {
        element: (
          <LanguageOfferArrivalProvider>
            <Outlet />
          </LanguageOfferArrivalProvider>
        ),
        children: [
          {
            path: "/en/contact",
            element: <LanguageSuggestion suggestion={suggestion} />,
          },
          {
            path: "/error",
            loader: () => {
              throw new Response(null, { status: 404 });
            },
            errorElement: <p>Missing page</p>,
          },
        ],
      },
    ],
    { initialEntries: ["/en/contact"] },
  );
  render(<RouterProvider router={navigation} />);
  expect(screen.getByRole("complementary")).toBeVisible();
  await act(() => navigation.navigate("/error"));
  expect(screen.getByText("Missing page")).toBeVisible();
  await act(() => navigation.navigate(-1));
  expect(screen.queryByRole("complementary")).toBeNull();
});

test("same-origin arrivals do not show a notice", () => {
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: `${window.location.origin}/en`,
  });
  render(<RouterProvider router={router()} />);
  expect(screen.queryByRole("complementary")).toBeNull();
});
