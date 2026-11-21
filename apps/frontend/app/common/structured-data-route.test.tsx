import { act, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  createMemoryRouter,
  Meta,
  Outlet,
  RouterProvider,
  UNSAFE_FrameworkContext,
} from "react-router";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { brand, media, page } from "~/common/cms-data.builders";
import { loader, meta } from "../routes/$";
import { getSettings, tryGetLocalizedPathname } from "~/cms-data.server";
import { handleIncomingRequest, handlePathname } from "~/common/routing.server";

vi.mock("~/cms-data.server", () => ({
  getSettings: vi.fn(),
  tryGetLocalizedPathname: vi.fn(),
}));
vi.mock("~/common/routing.server", () => ({
  handleIncomingRequest: vi.fn(),
  handlePathname: vi.fn(),
}));

const parentBrand = brand({ id: "puerta" });
const currentBrand = brand({
  id: "apartments",
  rootPath: "/apartments",
  baseTitle: "Apartments",
});
const content = {
  ...page("/apartments"),
  brand: currentBrand,
  title:
    'Rooms "with a view" — ¡Bienvenidos! </script><script>alert(1)</script>',
  seo: {
    description: 'A <b>CMS</b> description with "quotes"',
    image: media("room photo.jpg"),
  },
};
const rootData = {
  locale: "en",
  brand: currentBrand,
  allBrands: [parentBrand, currentBrand],
  footer: { id: "footer" },
  environment: { imagekitBaseUrl: "https://ik.imagekit.io/hostels" },
};

beforeEach(() => {
  vi.stubEnv("CANONICAL_HOSTNAME", "www.example.com");
  vi.mocked(handleIncomingRequest).mockResolvedValue({
    pageUrl: "/apartments",
    locale: "en",
  });
  vi.mocked(handlePathname).mockResolvedValue(content);
  vi.mocked(tryGetLocalizedPathname).mockResolvedValue("/apartments");
  vi.mocked(getSettings).mockResolvedValue({
    id: "settings",
    publishedLocales: {
      publishedLocales: [{ id: "en" }, { id: "es" }],
      fallbackLocale: { id: "en" },
    },
  } as Awaited<ReturnType<typeof getSettings>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function load(url = "https://www.example.com/en/apartments") {
  return loader({ request: new Request(url), url: new URL(url) } as Parameters<
    typeof loader
  >[0]);
}

function App() {
  return (
    <>
      <Meta />
      <Outlet />
    </>
  );
}

function createTestRouter(data: Awaited<ReturnType<typeof loader>>) {
  const router = createMemoryRouter(
    [
      {
        id: "root",
        Component: App,
        loader: () => rootData,
        children: [
          {
            id: "page",
            path: "*",
            Component: () => null,
            loader: ({ request }) => ({
              ...data,
              canonicalUrl: request.url,
              content: { ...content, title: "Next page" },
            }),
          },
        ],
      },
    ],
    {
      initialEntries: ["/en/apartments"],
      hydrationData: { loaderData: { root: rootData, page: data } },
    },
  );
  const framework: ComponentProps<
    typeof UNSAFE_FrameworkContext.Provider
  >["value"] = {
    manifest: {
      entry: { imports: [], module: "" },
      routes: {},
      url: "",
      version: "test",
    },
    routeModules: {
      root: { default: App },
      page: {
        default: () => null,
        meta: (args) => meta(args as Parameters<typeof meta>[0]),
      },
    },
    future: {},
    ssr: true,
    isSpaMode: false,
    routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
  };
  return {
    router,
    ui: (
      <UNSAFE_FrameworkContext.Provider value={framework}>
        <RouterProvider router={router} />
      </UNSAFE_FrameworkContext.Provider>
    ),
  };
}

test("SSR emits one safely escaped graph matching the canonical, title, description and image", async () => {
  const data = await load(
    "https://www.example.com/en/apartments?utm_source=test#rooms",
  );
  expect(data.canonicalUrl).toBe("https://www.example.com/en/apartments");
  const { router, ui } = createTestRouter(data);
  try {
    const html = renderToString(ui);
    const document = new DOMParser().parseFromString(html, "text/html");
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(scripts[0].textContent).not.toContain("</script>");
    const graph = JSON.parse(scripts[0].textContent!);
    const webpage = graph["@graph"].find(
      (node: { "@type": string }) => node["@type"] === "WebPage",
    );
    expect(webpage.name).toBe(document.title);
    expect(webpage.name).toContain(content.title);
    expect(webpage.url).toBe(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    );
    expect(webpage.description).toBe(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    );
    expect(webpage.image).toBe(
      document.querySelector('meta[name="og:image"]')?.getAttribute("content"),
    );
  } finally {
    router.dispose();
  }
});

test("client navigation replaces the JSON-LD graph without leaving duplicates", async () => {
  const { router, ui } = createTestRouter(await load());
  const view = render(ui);
  try {
    await act(() => router.navigate("/en/apartments/rooms"));
    await waitFor(() => {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      expect(scripts).toHaveLength(1);
      expect(JSON.parse(scripts[0].textContent!)["@graph"].at(-1).name).toBe(
        "Next page · Apartments",
      );
    });
  } finally {
    view.unmount();
    router.dispose();
  }
});

test.each([
  "unresolved-media-id",
  null,
  media(""),
  { ...media("document.pdf"), mimeType: "application/pdf" },
])(
  "omits unavailable SEO media without failing page metadata: %j",
  async (image) => {
    vi.mocked(handlePathname).mockResolvedValue({
      ...content,
      seo: { ...content.seo, image },
    });
    const { router, ui } = createTestRouter(await load());
    try {
      const document = new DOMParser().parseFromString(
        renderToString(ui),
        "text/html",
      );
      expect(document.title).toContain(content.title);
      expect(document.querySelector('meta[name="og:image"]')).toBeNull();
      expect(document.querySelector('meta[name="twitter:image"]')).toBeNull();
      const script = document.querySelector(
        'script[type="application/ld+json"]',
      );
      expect(script).not.toBeNull();
      expect(
        JSON.parse(script!.textContent!)["@graph"].at(-1).image,
      ).toBeUndefined();
    } finally {
      router.dispose();
    }
  },
);

test.each(["?preview=pages/test", "?preview="])(
  "suppresses preview markup for %s",
  async (query) => {
    const data = await load(`https://www.example.com/en/apartments${query}`);
    expect(data.includeStructuredData).toBe(false);
    const { router, ui } = createTestRouter(data);
    try {
      expect(renderToString(ui)).not.toContain("application/ld+json");
    } finally {
      router.dispose();
    }
  },
);

test("suppresses markup in maintenance mode, including authenticated previews", async () => {
  const settings = await getSettings(new Request("https://www.example.com"));
  vi.mocked(getSettings).mockResolvedValue({
    ...settings,
    maintenanceScreen: { show: true },
  });
  const { router, ui } = createTestRouter(await load());
  try {
    expect(renderToString(ui)).not.toContain("application/ld+json");
  } finally {
    router.dispose();
  }
});

test("does not emit page metadata when the loader failed or the page has an error", async () => {
  const args = { loaderData: undefined, matches: [] } as unknown as Parameters<
    typeof meta
  >[0];
  expect(meta(args)).toEqual([]);
  expect(
    meta({
      ...args,
      loaderData: await load(),
      error: new Error("Page failed"),
    }),
  ).toEqual([]);
});
