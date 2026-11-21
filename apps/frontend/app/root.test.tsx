import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isRouteErrorResponse } from "react-router";
import { fixture, i18n, makeData } from "../tests/root-fixture";
import type { Header } from "./layout/header";
import { useTheme } from "./themes";

vi.mock("./global.css?url", () => ({ default: "/test-global.css" }));
vi.mock("./cms-data.server", () => ({}));
vi.mock("./i18next.server", () => ({ i18nextMiddleware: vi.fn() }));
vi.mock("./common/auth", () => ({ isAuthenticated: vi.fn() }));
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children, ...props }: { children: ReactNode }) => (
    <div data-testid="maps" data-options={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));
vi.mock("./layout/header", () => ({
  Header: ({ onHeightChanged }: ComponentProps<typeof Header>) => {
    const theme = useTheme();
    useEffect(() => {
      onHeightChanged?.(80);
    }, [onHeightChanged]);
    return (
      <header data-theme={theme.headingTextColor}>
        <button onClick={() => onHeightChanged?.(120)}>Resize header</button>
      </header>
    );
  },
}));
vi.mock("./layout/footer", () => ({ Footer: () => <footer>Footer</footer> }));
vi.mock("./layout/preview-bar", () => ({
  PreviewBar: ({ adminLocale }: { adminLocale: string }) => (
    <aside>Preview: {adminLocale}</aside>
  ),
}));
vi.mock("./blocks/hero-heading-block", () => ({
  HeroHeadingBlock: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}));
vi.mock("./blocks/story-block", () => ({
  StoryBlock: () => <p>Error description</p>,
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  try {
    const unexpectedErrors = vi
      .mocked(console.error)
      .mock.calls.filter(([error, ...args]) => {
        if (args.length > 0) return true;
        if (isRouteErrorResponse(error))
          return error.status !== 404 && error.status !== 503;
        return (
          !(error instanceof Error) ||
          !["Root loader failed", "Page loader failed"].includes(error.message)
        );
      });
    expect(unexpectedErrors).toEqual([]);
  } finally {
    vi.restoreAllMocks();
  }
});

function expectShell(html: string, doc: Document, brand = "azul") {
  for (const tag of ["html", "head", "body"]) {
    expect(html.match(new RegExp(`<${tag}(?:\\s|>)`, "g"))).toHaveLength(1);
  }
  expect(doc.documentElement.lang).toBe("es");
  expect(doc.documentElement.dir).toBe("ltr");
  expect(doc.body.className).toBe("bg-white text-neutral-900 antialiased");
  expect(doc.head.querySelectorAll('meta[charset="utf-8"]')).toHaveLength(1);
  expect(doc.head.querySelectorAll('meta[name="viewport"]')).toHaveLength(1);
  expect(doc.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(3);
  expect(
    doc.head
      .querySelector('link[rel="icon"][type="image/svg+xml"]')
      ?.getAttribute("href"),
  ).toBe(`/assets/${brand}/favicon.svg`);
  expect(doc.head.querySelectorAll("title")).toHaveLength(1);
  expect(doc.body.querySelector("title")).toBeNull();
  expect(doc.querySelectorAll('script[type="module"]')).toHaveLength(1);
}

function expectAnalytics(doc: Document, enabled: boolean) {
  expect(
    doc.head.querySelectorAll('script[data-domain="example.com"]'),
  ).toHaveLength(enabled ? 1 : 0);
}

describe("root document server rendering", () => {
  test("normal page retains providers, metadata, analytics and scroll restoration", async () => {
    const { html, document: doc, status } = await fixture().server("/normal");
    expectShell(html, doc);
    expect(status).toBe(200);
    expect(doc.title).toBe("Normal page");
    expectAnalytics(doc, true);
    expect(doc.querySelector("header")?.getAttribute("data-theme")).toBe(
      "text-azul-900",
    );
    expect(doc.querySelector("footer")).not.toBeNull();
    expect(
      doc.querySelector('[data-testid="maps"]')?.getAttribute("data-options"),
    ).toBe(
      JSON.stringify({ apiKey: "test-key", language: "es-419", region: "CO" }),
    );
    expect(doc.documentElement.style.scrollPaddingTop).toBe("32px");
    expect(html).toContain("react-router-scroll-positions");
  });

  test.each([true, false])(
    "maintenance access preserves chrome visibility when authorized=%s",
    async (authorized) => {
      const data = makeData();
      data.settings.maintenanceScreen!.show = true;
      data.isAuthorized = authorized;
      const { html, document: doc } = await fixture(data).server(
        authorized ? "/normal" : "/login",
      );
      expectShell(html, doc);
      expect(doc.querySelectorAll("header, footer")).toHaveLength(
        authorized ? 2 : 0,
      );
      expect(doc.querySelector("aside")?.textContent).toBe(
        authorized ? "Preview: en" : undefined,
      );
      expect(doc.querySelector("main")?.textContent).toContain("Page content");
      expectAnalytics(doc, true);
    },
  );

  test.each([
    ["/not-found", 404, "Page not found"],
    ["/error", 500, "Something went wrong"],
  ])(
    "%s retains branded error content and title",
    async (path, status, heading) => {
      const result = await fixture().server(path);
      expectShell(result.html, result.document);
      expect(result.status).toBe(status);
      expect(result.document.title).toBe(`${heading} · Hostel Azul`);
      expect(result.document.querySelector("h1")?.textContent).toBe(heading);
      expect(result.document.querySelectorAll("header, footer")).toHaveLength(
        2,
      );
      expect(result.document.querySelector('[data-testid="maps"]')).toBeNull();
      expectAnalytics(result.document, true);
      expect(result.document.documentElement.style.scrollPaddingTop).toBe("");
      expect(result.html).not.toContain("react-router-scroll-positions");
    },
  );

  test("503 retains maintenance message, Puerta theme and login link", async () => {
    const result = await fixture().server("/maintenance");
    expectShell(result.html, result.document);
    expect(result.status).toBe(503);
    expect(result.document.title).toBe("Under maintenance");
    expect(result.document.querySelector("h1")?.textContent).toBe(
      "Under maintenance",
    );
    expect(result.document.querySelector("a")?.getAttribute("href")).toBe(
      "/login",
    );
    expect(
      result.document.querySelector("a")?.classList.contains("bg-puerta-200"),
    ).toBe(true);
    expect(result.document.querySelectorAll("header, footer")).toHaveLength(0);
    expectAnalytics(result.document, false);
    expect(result.html).not.toContain("react-router-scroll-positions");
  });

  test.each([
    ["/root-failure", 500],
    ["/root-503", 503],
  ])("%s renders fatal content without root data", async (path, status) => {
    const result = await fixture().server(path);
    expectShell(result.html, result.document, "puerta");
    expect(result.status).toBe(status);
    expect(result.document.title).toBe("Fatal error");
    expect(result.document.querySelector("h1")?.textContent).toBe(
      "Fatal error",
    );
    expect(result.document.querySelector("main")?.textContent).toContain(
      "Please try again.",
    );
    expect(result.document.querySelectorAll("header, footer")).toHaveLength(0);
    expectAnalytics(result.document, false);
    expect(result.html).not.toContain("react-router-scroll-positions");
  });

  test("document language and direction follow translations without root data", async () => {
    await i18n.changeLanguage("ar");
    try {
      const result = await fixture().server("/root-failure");
      expect(result.document.documentElement.lang).toBe("ar");
      expect(result.document.documentElement.dir).toBe("rtl");
    } finally {
      await i18n.changeLanguage("es");
    }
  });

  test("missing analytics configuration omits analytics", async () => {
    const data = makeData();
    data.analyticsDomain = undefined;
    const result = await fixture(data).server("/normal");
    expectAnalytics(result.document, false);
  });
});

test("header measurements update padding and document nodes survive normal/error/normal navigation", async () => {
  const router = fixture().client();
  try {
    const nodes = [document.documentElement, document.head, document.body];
    const stylesheets = () =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]'), (link) =>
        link.getAttribute("href"),
      );
    const stylesheetUrls = stylesheets();
    expect(document.documentElement.style.scrollPaddingTop).toBe("112px");
    fireEvent.click(screen.getByRole("button", { name: "Resize header" }));
    expect(document.documentElement.style.scrollPaddingTop).toBe("152px");
    await act(() => router.navigate("/not-found"));
    expect(document.title).toBe("Page not found · Hostel Azul");
    expect(document.documentElement.style.scrollPaddingTop).toBe("");
    expect(document.documentElement).toBe(nodes[0]);
    expect(document.head).toBe(nodes[1]);
    expect(document.body).toBe(nodes[2]);
    // React Router 8.5.2 remounts Layout at the root error boundary, so check
    // stylesheet availability rather than link identity across that transition.
    expect(stylesheets()).toEqual(stylesheetUrls);
    await act(() => router.navigate("/normal"));
    expect(document.title).toBe("Normal page");
    expect(document.documentElement.style.scrollPaddingTop).toBe("112px");
    expect(document.documentElement).toBe(nodes[0]);
    expect(document.head).toBe(nodes[1]);
    expect(document.body).toBe(nodes[2]);
    expect(stylesheets()).toEqual(stylesheetUrls);
  } finally {
    router.dispose();
  }
});
