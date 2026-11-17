import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createInstance } from "i18next";
import type { PropsWithChildren } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  banner,
  customLink,
  internalLink,
  page,
} from "~/common/cms-data.builders";
import { ThemeProvider } from "~/themes";
import { Banner, type BannerProps } from "./banner";

const i18n = createInstance();
await i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: { banner: { dismiss: "Dismiss" } } },
    es: { translation: { banner: { dismiss: "Cerrar" } } },
  },
});

function Wrapper({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider themeColor="puerta">
        <MemoryRouter>{children}</MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>
  );
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function dismiss() {
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
}

test("remembers dismissal across remounts and stores a revised promotion", async () => {
  const original = banner("Original promotion");
  const first = render(<Banner {...original} />, { wrapper: Wrapper });
  expect(screen.getByText(original.message)).toBeVisible();
  await dismiss();
  first.unmount();

  const refreshed = render(<Banner {...original} />, { wrapper: Wrapper });
  expect(screen.queryByRole("button")).toBeNull();

  const revised = { ...original, message: "New promotion" };
  refreshed.rerender(<Banner {...revised} />);
  expect(screen.getByText(revised.message)).toBeVisible();
  await dismiss();
  refreshed.unmount();

  render(<Banner {...revised} />, { wrapper: Wrapper });
  expect(screen.queryByRole("button")).toBeNull();
  expect(localStorage.length).toBe(1);
});

describe("changes that show a dismissed banner again", () => {
  test.each<[string, (original: BannerProps) => BannerProps]>([
    ["banner ID", (original) => ({ ...original, id: "another-banner" })],
    ["message", (original) => ({ ...original, message: "Updated message" })],
    [
      "CTA visibility",
      (original) => ({ ...original, cta: { ...original.cta, show: false } }),
    ],
    [
      "CTA label",
      (original) => ({
        ...original,
        cta: { ...original.cta, label: "Reserve" },
      }),
    ],
    [
      "CTA external destination",
      (original) => ({
        ...original,
        cta: { ...original.cta, link: customLink("https://example.com/new") },
      }),
    ],
    [
      "CTA internal destination",
      (original) => ({
        ...original,
        cta: { ...original.cta, link: internalLink("/new") },
      }),
    ],
  ])("%s", async (_, change) => {
    const original = banner("A promotion");
    const view = render(<Banner {...original} />, { wrapper: Wrapper });
    await dismiss();
    view.rerender(<Banner {...change(original)} />);
    expect(screen.getByRole("button")).toBeVisible();
  });

  test.each(["queryString", "fragment", "pathname"] as const)(
    "internal link %s",
    async (field) => {
      const original = {
        ...banner("A promotion"),
        cta: {
          show: true,
          label: "Book",
          link: { ...internalLink("/book"), doc: page("/book") },
        },
      };
      const view = render(<Banner {...original} />, { wrapper: Wrapper });
      await dismiss();
      const link = original.cta.link;
      view.rerender(
        <Banner
          {...original}
          cta={{
            ...original.cta,
            link: {
              ...link,
              ...(field === "pathname"
                ? { doc: { ...link.doc, pathname: "/new-booking" } }
                : { [field]: "offer" }),
            },
          }}
        />,
      );
      expect(screen.getByRole("button")).toBeVisible();
    },
  );
});

test("ignores timestamps and unrelated linked-page data", async () => {
  const link = { ...internalLink("/book"), doc: page("/book") };
  const original = {
    ...banner("A promotion"),
    cta: { show: true, label: "Book", link },
  };
  const view = render(<Banner {...original} />, { wrapper: Wrapper });
  await dismiss();
  view.rerender(
    <Banner
      {...original}
      updatedAt="2026-11-17T00:00:00Z"
      cta={{
        ...original.cta,
        link: {
          ...link,
          doc: { ...link.doc, title: "New title" },
        },
      }}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});

test("ignores hidden CTA edits but shows the banner when the CTA is enabled", async () => {
  const original = { ...banner("A promotion"), cta: { show: false } };
  const view = render(<Banner {...original} />, { wrapper: Wrapper });
  await dismiss();
  const cta = { show: false, label: "New label", link: customLink("/new") };
  view.rerender(<Banner {...original} cta={cta} />);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<Banner {...original} cta={{ ...cta, show: true }} />);
  expect(screen.getByRole("button")).toBeVisible();
});

test("keeps independent dismissals for banners and languages", async () => {
  const first = banner("First promotion");
  const second = banner("Second promotion");
  const view = render(<Banner {...first} />, { wrapper: Wrapper });
  await dismiss();
  view.rerender(<Banner {...second} />);
  expect(screen.getByText(second.message)).toBeVisible();
  await dismiss();
  view.rerender(<Banner {...first} />);
  expect(screen.queryByRole("button")).toBeNull();

  await act(() => i18n.changeLanguage("es"));
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeVisible();
  await dismiss();
  await act(() => i18n.changeLanguage("en"));
  expect(screen.queryByRole("button")).toBeNull();
  expect(localStorage.length).toBe(3);
});

test.each(["getItem", "setItem", "localStorage"] as const)(
  "supports in-memory dismissal when %s throws",
  async (operation) => {
    if (operation === "localStorage") {
      vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
    } else {
      vi.spyOn(Storage.prototype, operation).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
    }
    const original = banner("A promotion");
    const view = render(<Banner {...original} />, { wrapper: Wrapper });
    expect(screen.getByText(original.message)).toBeVisible();
    await dismiss();
    view.rerender(<Banner {...original} message="Changed promotion" />);
    expect(screen.getByText("Changed promotion")).toBeVisible();
    await dismiss();
  },
);

test("does not persist banners without an ID", async () => {
  const getItem = vi.spyOn(Storage.prototype, "getItem");
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  const view = render(<Banner message="A promotion" />, { wrapper: Wrapper });
  await dismiss();
  view.unmount();
  render(<Banner message="A promotion" />, { wrapper: Wrapper });
  expect(screen.getByText("A promotion")).toBeVisible();
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

test.each([false, true])(
  "renders and hydrates without flashing or storage access during SSR (dismissed: %s)",
  async (dismissed) => {
    const original = banner("A promotion");
    if (dismissed) {
      const view = render(<Banner {...original} />, { wrapper: Wrapper });
      await dismiss();
      view.unmount();
    }
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const ui = (
      <Wrapper>
        <Banner {...original} />
      </Wrapper>
    );
    const html = renderToString(ui);
    expect(getItem).not.toHaveBeenCalled();
    expect(html).not.toContain(original.message);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const messagesAdded: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          messagesAdded.push(node.textContent ?? "");
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(() => {
        root = hydrateRoot(container, ui, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      if (dismissed) {
        expect(container).not.toHaveTextContent(original.message);
        expect(messagesAdded.join("")).not.toContain(original.message);
      } else {
        expect(container).toHaveTextContent(original.message);
      }
    } finally {
      observer.disconnect();
      await act(() => root?.unmount());
      container.remove();
    }
  },
);
