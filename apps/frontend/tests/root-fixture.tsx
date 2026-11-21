import { render } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { renderToString } from "react-dom/server";
import type {
  EntryContext,
  LoaderFunction,
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
import { brand as makeBrand } from "../app/common/cms-data.builders";
import App, { ErrorBoundary, Layout, links, meta } from "../app/root";
import type { loader } from "../app/root";

type Framework = Omit<EntryContext, "branches" | "staticHandlerContext">;

export const i18n = createInstance();
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

export function makeData(): RootData {
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

function rootLoader(data: RootData): LoaderFunction {
  return ({ request }) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/root-failure") throw new Error("Root loader failed");
    if (pathname === "/root-503") throw new Response(null, { status: 503 });
    return data;
  };
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
function createFramework(): Framework {
  return {
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
}
async function renderServer(
  framework: Framework,
  data: RootData,
  path: string,
) {
  const handler = createStaticHandler([
    {
      id: "root",
      path: "/",
      loader: rootLoader(data),
      ErrorBoundary,
      children: [{ id: "page", path: ":screen", loader: loadPage }],
    },
  ]);
  const context = await handler.query(new Request(`http://localhost${path}`));
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
}
function renderClient(framework: Framework, data: RootData) {
  // Use the framework's actual Layout wrapping, with local fixture loaders.
  const routes = UNSAFE_createClientRoutes(
    framework.manifest.routes,
    routeModules,
    null,
    true,
    false,
  );
  routes[0].loader = rootLoader(data);
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
}
export function fixture(data = makeData()) {
  const framework = createFramework();
  return {
    server: (path: string) => renderServer(framework, data, path),
    client: () => renderClient(framework, data),
  };
}
