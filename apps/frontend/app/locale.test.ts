import { beforeEach, expect, test, vi } from "vitest";

const { getSettings, tryGetLocalizedPathname } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  tryGetLocalizedPathname: vi.fn(),
}));
vi.mock("~/cms-data.server", () => ({ getSettings, tryGetLocalizedPathname }));
vi.mock("~/common/auth", () => ({ isAuthenticated: vi.fn() }));
import { action } from "./routes/locale";
import { localeCookie } from "~/i18next.server";

beforeEach(() => {
  getSettings.mockResolvedValue({
    publishedLocales: { publishedLocales: [{ id: "en" }, { id: "es" }] },
  });
  tryGetLocalizedPathname.mockImplementation((_request, _pathname, locale) =>
    Promise.resolve(locale === "es" ? "/azul/contacto" : "/azul/contact"),
  );
});

test.each([
  ["es", "/azul/contacto?source=friend&tag=a&tag=b#directions"],
  ["en", "/azul/contact?source=friend&tag=a&tag=b#directions"],
])(
  "saves the deliberate %s choice and preserves the full destination",
  async (locale, destination) => {
    const form = new FormData();
    form.set("locale", locale);
    form.set("redirectTo", destination);
    const request = new Request("https://example.com/locale", {
      method: "POST",
      body: form,
    });
    let response: unknown;
    try {
      await action({ request } as never);
    } catch (error) {
      response = error;
    }
    expect(response).toBeInstanceOf(Response);
    const redirect = response as Response;
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe(`/${locale}${destination}`);
    expect(await localeCookie.parse(redirect.headers.get("Set-Cookie"))).toBe(
      locale,
    );
  },
);
