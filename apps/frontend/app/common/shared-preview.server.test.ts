import { afterEach, expect, test, vi } from "vitest";
import { banner, brand } from "./cms-data.builders";
import { getBanner } from "~/cms-data.server";
import { getHeaderLocale } from "~/i18next.server";
import {
  getPreviewAdminLocale,
  loadSharedPreview,
} from "./shared-preview.server";

vi.mock("~/cms-data.server", () => ({ getBanner: vi.fn() }));
vi.mock("~/i18next.server", () => ({
  getHeaderLocale: vi.fn(async () => "en"),
}));
afterEach(() => vi.clearAllMocks());
const brands = [
  brand({ id: "puerta", rootPath: "/" }),
  brand({ id: "aqua", rootPath: "/aqua" }),
];
const request = new Request("http://preview.local/en");

test("ordinary pages do not load a shared preview", async () => {
  expect(
    await loadSharedPreview(request, new URL(request.url), "en", brands, true),
  ).toBeNull();
  expect(getBanner).not.toHaveBeenCalled();
});

test("an unassigned banner is fetched independently in the chosen brand", async () => {
  const edited = banner("Saved banner");
  vi.mocked(getBanner).mockResolvedValueOnce(edited);
  const url = new URL(
    `http://preview.local/en/aqua?preview=banners/${edited.id}&previewBrand=aqua&skipcache=true`,
  );
  const result = await loadSharedPreview(request, url, "en", brands, true);
  expect(result?.brand.id).toBe("aqua");
  expect(result?.banner).toEqual(edited);
  expect(getBanner).toHaveBeenCalledWith(request, edited.id, "en");
});

test("brand selection redirects to its real homepage without losing preview parameters", async () => {
  const url = new URL(
    "http://preview.local/en?preview=globals/footer&previewBrand=aqua&lng=en&adminLng=es",
  );
  const response = await loadSharedPreview(
    request,
    url,
    "en",
    brands,
    true,
  ).catch((error: unknown) => error);
  expect(response).toBeInstanceOf(Response);
  const location = new URL(
    (response as Response).headers.get("Location")!,
    url,
  );
  expect(location.pathname).toBe("/en/aqua");
  expect(location.searchParams.get("preview")).toBe("globals/footer");
  expect(location.searchParams.get("adminLng")).toBe("es");
  expect(location.searchParams.get("skipcache")).toBe("true");
});

test("maintenance authorization is not bypassed by a preview redirect", async () => {
  const url = new URL(
    "http://preview.local/en?preview=globals/footer&previewBrand=aqua",
  );
  expect(
    (await loadSharedPreview(request, url, "en", brands, false))?.brand.id,
  ).toBe("aqua");
});

test("editor language is independent of content language and limited to supported admin languages", async () => {
  const url = new URL("http://preview.local/en?adminLng=es");
  expect(await getPreviewAdminLocale(request, url, true, false)).toBe("es");
  expect(getHeaderLocale).not.toHaveBeenCalled();
  expect(
    await getPreviewAdminLocale(request, url, false, false),
  ).toBeUndefined();
  url.searchParams.set("adminLng", "unrecognized");
  expect(await getPreviewAdminLocale(request, url, true, false)).toBe("en");
});
