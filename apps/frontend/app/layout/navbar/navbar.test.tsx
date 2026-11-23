import { act, fireEvent, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Link, MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { brand, customLink, internalLink } from "~/common/cms-data.builders";
import { ThemeProvider } from "~/themes";
import { Navbar } from "./navbar";

vi.mock("~/common/environment", () => ({
  useEnvironment: () => ({ imagekitBaseUrl: "https://images.example.com" }),
}));

const i18n = createInstance();
await i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: {} } },
});

const testBrand = brand({
  navLinks: [{ label: "Rooms", link: internalLink("/rooms") }],
  bookCta: {
    show: true,
    label: "Book now",
    link: customLink("https://booking.example.com"),
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
  // jsdom has no layout. Model the sticky navbar following the scroll position.
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    () => window.scrollY,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(bookingEnabled = true) {
  const brand = {
    ...testBrand,
    bookCta: { ...testBrand.bookCta, show: bookingEnabled },
  };
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider themeColor="puerta">
        <MemoryRouter>
          <Navbar
            brand={brand}
            allBrands={[brand]}
            publishedLocales={[{ id: "en", displayLabel: "English" }]}
          />
          <Link to="/next">Next page</Link>
          <button type="button">Outside navbar</button>
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>,
  );
  act(() => vi.advanceTimersByTime(100));
  return screen.getByRole("navigation");
}

function scrollTo(y: number) {
  vi.spyOn(window, "scrollY", "get").mockReturnValue(y);
  fireEvent.scroll(window);
}

function floatingCta() {
  return screen
    .getAllByRole("link", { name: "Book now" })
    .find((link) => link.classList.contains("fixed"))!;
}

test("hides only beyond 100px and swaps the desktop booking CTA", () => {
  const nav = setup();
  expect(nav).not.toHaveClass("-translate-y-full");
  expect(floatingCta()).toHaveClass("sm:invisible");

  scrollTo(100);
  expect(nav).not.toHaveClass("-translate-y-full");
  scrollTo(101);
  expect(nav).toHaveClass("-translate-y-full");
  expect(nav).not.toHaveClass("sm:translate-y-0");
  expect(floatingCta()).not.toHaveClass("sm:invisible");
  expect(floatingCta()).toHaveAttribute("href", "https://booking.example.com");

  scrollTo(200);
  scrollTo(199);
  expect(nav).toHaveClass("translate-y-0");
  expect(floatingCta()).toHaveClass("sm:invisible");
});

test("waits until the navbar sticks below a banner", () => {
  const nav = setup();
  vi.spyOn(nav, "offsetTop", "get").mockReturnValue(150);
  scrollTo(120);
  expect(nav).not.toHaveClass("-translate-y-full");
  expect(floatingCta()).toHaveClass("sm:invisible");
  scrollTo(150);
  expect(nav).toHaveClass("-translate-y-full");
  expect(floatingCta()).not.toHaveClass("sm:invisible");
});

test("ignores scroll events without movement and restores the navbar at the top", () => {
  const nav = setup();
  scrollTo(200);
  scrollTo(200);
  expect(nav).toHaveClass("-translate-y-full");
  scrollTo(0);
  expect(nav).not.toHaveClass("-translate-y-full");
  expect(floatingCta()).toHaveClass("sm:invisible");
});

test("navigation reveals the navbar and temporarily ignores scroll direction", () => {
  const nav = setup();
  scrollTo(200);
  expect(nav).toHaveClass("-translate-y-full");
  fireEvent.click(screen.getByRole("link", { name: "Next page" }));
  expect(nav).toHaveClass("translate-y-0");
  expect(floatingCta()).toHaveClass("sm:invisible");
  scrollTo(400);
  expect(nav).toHaveClass("translate-y-0");
  act(() => vi.advanceTimersByTime(100));
  scrollTo(500);
  expect(nav).toHaveClass("-translate-y-full");
});

test("does not render either booking CTA when disabled", () => {
  const nav = setup(false);
  scrollTo(200);
  expect(nav).toHaveClass("-translate-y-full");
  expect(screen.queryByRole("link", { name: "Book now" })).toBeNull();
});

test("keyboard focus reveals the navbar and keeps it visible while focus stays inside", () => {
  const nav = setup();
  scrollTo(200);
  const rooms = screen.getByRole("link", { name: "Rooms" });
  act(() => rooms.focus());
  expect(nav).toHaveClass("translate-y-0");
  scrollTo(300);
  expect(nav).toHaveClass("translate-y-0");
  const booking = screen
    .getAllByRole("link", { name: "Book now" })
    .find((link) => nav.contains(link))!;
  act(() => booking.focus());
  expect(nav).toHaveClass("translate-y-0");
  act(() => screen.getByRole("button", { name: "Outside navbar" }).focus());
  expect(nav).toHaveClass("-translate-y-full");
});

test("keeps the floating CTA available until it loses focus", () => {
  const nav = setup();
  scrollTo(200);
  const booking = floatingCta();
  act(() => booking.focus());
  scrollTo(199);
  expect(nav).toHaveClass("translate-y-0");
  expect(booking).toHaveFocus();
  expect(booking).not.toHaveClass("sm:invisible");
  act(() => screen.getByRole("button", { name: "Outside navbar" }).focus());
  expect(booking).toHaveClass("sm:invisible");
});
