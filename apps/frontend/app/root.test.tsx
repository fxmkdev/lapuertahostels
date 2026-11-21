import type { ComponentProps, ReactNode } from "react";
import { useEffect } from "react";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import type {
  EntryContext,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  createMemoryRouter,
  createStaticHandler,
  RouterProvider,
  ServerRouter,
  UNSAFE_createClientRoutes,
  UNSAFE_FrameworkContext,
} from "react-router";
import { richTextRoot } from "@lapuertahostels/rich-text";
import { brand as makeBrand } from "./common/cms-data.builders";
import App, { ErrorBoundary, Layout, links, meta } from "./root";
import type { loader } from "./root";
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

const i18n = createInstance();
await i18n.init({
  lng: "es",
  fallbackLng: "es",
  resources: {
    ar: { translation: { errorBoundary: { title: "Fatal error" } } },
    es: {
      translation: {
        errorBoundary: {
          title: "Fatal error",
          text: "<p>Please try again.</p>",
        },
        maintenanceScreen: { login: "Log in" },
      },
    },
  },
});

type RootData = Awaited<ReturnType<typeof loader>>;

function makeData(): RootData {
  const brand = makeBrand({
    id: "azul",
    themeColor: "azul",
    baseTitle: "Hostel Azul",
  });
  return {
    locale: "es",
    brand,
    allBrands: [brand],
    common: {
      id: "common",
      pageNotFoundScreen: { heading: "Page not found", text: richTextRoot() },
      errorScreen: { heading: "Something went wrong", text: richTextRoot() },
    },
    footer: { id: "footer" },
    settings: {
      id: "settings",
      publishedLocales: { publishedLocales: ["es"], fallbackLocale: "es" },
      maintenanceScreen: { show: false, message: "Under maintenance" },
      maps: { region: "CO" },
    },
    environment: {
      googleMapsApiKey: "test-key",
      version: "test",
      payloadCmsBaseUrl: "http://cms.test",
      imagekitBaseUrl: "http://images.test",
      preview: undefined,
      useImageCacheBuster: false,
    },
    isAuthorized: true,
    adminLocale: "en",
    publishedLocales: [
      {
        id: "es",
        locale: "es",
        displayLabel: "Español",
        googleMapsLanguage: "es-419",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
    analyticsDomain: "example.com",
  };
}

function fixture(data = makeData()) {
  function loadRoot({ request }: LoaderFunctionArgs) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/root-failure") throw new Error("Root loader failed");
    if (pathname === "/root-503") throw new Response(null, { status: 503 });
    return data;
  }
  function loadPage({ request }: LoaderFunctionArgs) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/not-found") throw new Response(null, { status: 404 });
    if (pathname === "/maintenance") throw new Response(null, { status: 503 });
    if (pathname === "/error") throw new Error("Page loader failed");
    return null;
  }
  function Page() {
    return (
      <>
        <title>Normal page</title>
        <h1>Page content</h1>
      </>
    );
  }
  const routeModules = {
    root: {
      default: App,
      Layout,
      ErrorBoundary,
      links,
      meta: meta as MetaFunction,
    },
    page: { default: Page },
  };
  function entry(id: string, path: string, parentId?: string) {
    return {
      id,
      path,
      parentId,
      module: `/test-${id}.js`,
      hasLoader: true,
      hasAction: false,
      hasClientLoader: false,
      hasClientAction: false,
      hasClientMiddleware: false,
      hasErrorBoundary: id === "root",
      clientActionModule: undefined,
      clientLoaderModule: undefined,
      clientMiddlewareModule: undefined,
      hydrateFallbackModule: undefined,
    };
  }
  const framework: Omit<EntryContext, "branches" | "staticHandlerContext"> = {
    manifest: {
      entry: { module: "/test-entry.js", imports: [] },
      routes: {
        root: entry("root", "/"),
        page: entry("page", ":screen", "root"),
      },
      url: "/test-manifest.js",
      version: "test",
    },
    routeModules,
    future: {},
    ssr: true,
    isSpaMode: false,
    routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
  };

  return {
    async server(path: string) {
      const handler = createStaticHandler([
        {
          id: "root",
          path: "/",
          loader: loadRoot,
          ErrorBoundary,
          children: [{ id: "page", path: ":screen", loader: loadPage }],
        },
      ]);
      const context = await handler.query(
        new Request(`http://localhost${path}`),
      );
      if (context instanceof Response) throw new Error("Unexpected response");
      const html = renderToString(
        <I18nextProvider i18n={i18n}>
          <ServerRouter
            url={`http://localhost${path}`}
            context={{
              ...framework,
              branches: [],
              staticHandlerContext: context,
            }}
          />
        </I18nextProvider>,
      );
      return {
        html,
        document: new DOMParser().parseFromString(html, "text/html"),
        status: context.statusCode,
      };
    },
    client() {
      // Use the framework's actual Layout wrapping, with local fixture loaders.
      const routes = UNSAFE_createClientRoutes(
        framework.manifest.routes,
        routeModules,
        null,
        true,
        false,
      );
      routes[0].loader = loadRoot;
      routes[0].children![0].loader = loadPage;
      const router = createMemoryRouter(routes, {
        initialEntries: ["/normal"],
        hydrationData: { loaderData: { root: data, page: null } },
      });
      render(
        <I18nextProvider i18n={i18n}>
          <UNSAFE_FrameworkContext value={framework}>
            <RouterProvider router={router} />
          </UNSAFE_FrameworkContext>
        </I18nextProvider>,
        { container: document },
      );
      return router;
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
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
