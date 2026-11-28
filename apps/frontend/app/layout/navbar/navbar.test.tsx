import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Link, MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { brand, customLink, internalLink } from "~/common/cms-data.builders";
import { ThemeProvider } from "~/themes";
import type { NavbarProps } from "./navbar";
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
  navLinks: [{ id: "rooms", label: "Rooms", link: internalLink("/rooms") }],
  bookCta: {
    show: true,
    label: "Book now",
    link: customLink("https://booking.example.com"),
  },
});

type ObservedElement = {
  callback: ResizeObserverCallback;
  element?: Element;
};
let observedElements: ObservedElement[];

beforeEach(() => {
  vi.useFakeTimers();
  observedElements = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observation: ObservedElement;
      constructor(callback: ResizeObserverCallback) {
        this.observation = { callback };
        observedElements.push(this.observation);
      }
      observe(element: Element) {
        this.observation.element = element;
      }
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

function setup(props: Partial<NavbarProps> = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider themeColor="puerta">
        <MemoryRouter>
          <Navbar
            brand={testBrand}
            allBrands={[testBrand]}
            publishedLocales={[{ id: "en", displayLabel: "English" }]}
            {...props}
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

function background(nav: HTMLElement) {
  return nav.querySelector(":scope > [aria-hidden='true']")!;
}

function desktopBooking(nav: HTMLElement) {
  return within(nav).getByRole("link", { name: "Book now" });
}

const HIDDEN_TRANSLATION = "-translate-y-[var(--navbar-height)]";

test("hides the navbar background beyond 100px while desktop booking stays in place", () => {
  const nav = setup();
  const booking = desktopBooking(nav);
  expect(background(nav)).not.toHaveClass(HIDDEN_TRANSLATION);
  expect(booking).not.toHaveClass("sm:shadow-lg");

  scrollTo(100);
  expect(background(nav)).not.toHaveClass(HIDDEN_TRANSLATION);
  scrollTo(101);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  expect(nav).not.toHaveClass(HIDDEN_TRANSLATION);
  expect(nav).toHaveClass("pointer-events-none");
  expect(background(nav)).not.toHaveClass("pointer-events-auto");
  expect(desktopBooking(nav)).toBe(booking);
  expect(booking).toHaveClass("pointer-events-auto", "sm:shadow-lg");
  expect(booking).toHaveAttribute("href", "https://booking.example.com");

  scrollTo(200);
  scrollTo(199);
  expect(background(nav)).toHaveClass("translate-y-0", "pointer-events-auto");
  expect(booking).not.toHaveClass("sm:shadow-lg");
});

test("waits until the navbar sticks below a banner", () => {
  const nav = setup();
  vi.spyOn(nav, "offsetTop", "get").mockReturnValue(150);
  scrollTo(120);
  expect(background(nav)).not.toHaveClass(HIDDEN_TRANSLATION);
  scrollTo(150);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
});

test("ignores scroll events without movement and restores the navbar at the top", () => {
  const nav = setup();
  scrollTo(200);
  scrollTo(200);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  scrollTo(0);
  expect(background(nav)).not.toHaveClass(HIDDEN_TRANSLATION);
});

test("navigation reveals the navbar and temporarily ignores scroll direction", () => {
  const nav = setup();
  scrollTo(200);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  fireEvent.click(screen.getByRole("link", { name: "Next page" }));
  expect(background(nav)).toHaveClass("translate-y-0");
  scrollTo(400);
  expect(background(nav)).toHaveClass("translate-y-0");
  act(() => vi.advanceTimersByTime(100));
  scrollTo(500);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
});

test("does not render either booking CTA when disabled", () => {
  const nav = setup({ brand: { ...testBrand, bookCta: { show: false } } });
  scrollTo(200);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  expect(screen.queryByRole("link", { name: "Book now" })).toBeNull();
});

test("focus on other navbar controls reveals the navbar immediately and keeps it visible", () => {
  const nav = setup();
  scrollTo(200);
  act(() => screen.getByRole("link", { name: "Rooms" }).focus());
  expect(background(nav)).toHaveClass("translate-y-0", "duration-0");
  scrollTo(300);
  expect(background(nav)).toHaveClass("translate-y-0");
  act(() => screen.getByRole("button", { name: "Open main menu" }).focus());
  expect(background(nav)).toHaveClass("translate-y-0");
  act(() => screen.getByRole("button", { name: "Outside navbar" }).focus());
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
});

test("booking focus leaves the navbar collapsed and survives scrolling in either direction", () => {
  const nav = setup();
  const booking = desktopBooking(nav);
  scrollTo(200);
  act(() => booking.focus());
  expect(booking).toHaveFocus();
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  scrollTo(199);
  expect(background(nav)).toHaveClass("translate-y-0");
  expect(booking).toHaveFocus();
  scrollTo(300);
  expect(background(nav)).toHaveClass(HIDDEN_TRANSLATION);
  expect(booking).toHaveFocus();
});

test("keeps both booking links mounted through rapid scroll reversals", () => {
  const nav = setup();
  const bookings = screen.getAllByRole("link", { name: "Book now" });
  for (const [y, hidden] of [
    [200, true],
    [190, false],
    [210, true],
    [180, false],
  ] as const) {
    scrollTo(y);
    expect(screen.getAllByRole("link", { name: "Book now" })).toEqual(bookings);
    expect(background(nav).classList.contains(HIDDEN_TRANSLATION)).toBe(hidden);
  }
});

test("shares the measured navbar height with the sliding controls and height callback", () => {
  const onHeightChanged = vi.fn();
  const nav = setup({ onHeightChanged });
  const observation = observedElements.find(({ element }) => element === nav)!;
  for (const height of [76, 88]) {
    act(() => {
      const boxSize = [{ blockSize: height, inlineSize: 1280 }];
      observation.callback(
        [
          {
            target: nav,
            borderBoxSize: boxSize,
            contentBoxSize: boxSize,
            devicePixelContentBoxSize: boxSize,
            contentRect: new DOMRect(0, 0, 1280, height),
          },
        ],
        { observe() {}, unobserve() {}, disconnect() {} },
      );
    });
    expect(nav.style.getPropertyValue("--navbar-height")).toBe(`${height}px`);
    expect(onHeightChanged).toHaveBeenLastCalledWith(height);
    scrollTo(200);
  }
});
