import { describe, expect, test } from "vitest";
import {
  brand,
  customLink,
  internalLink,
  media,
  page,
} from "./cms-data.builders";
import { buildStructuredData } from "./structured-data";

function input() {
  const parentBrand = brand({ id: "puerta", name: "La Puerta Hostels" });
  const currentBrand = brand({
    id: "apartments",
    name: "La Puerta Apartments",
    rootPath: "/apartments",
  });
  return {
    parentBrand,
    brand: currentBrand,
    page: {
      ...page("/apartments/rooms"),
      brand: currentBrand,
      title: "Rooms",
      seo: { description: "Choose your room", image: media("room photo.jpg") },
    },
    footer: {
      id: "footer",
      socialLinks: [
        {
          platform: "instagram" as const,
          link: customLink("https://instagram.com/lapuertahostels"),
        },
        {
          platform: "whatsapp" as const,
          link: customLink("https://wa.me/message/example"),
        },
      ],
    },
    canonicalUrl:
      "https://www.example.com/en/apartments/rooms?utm_source=test#rooms",
    locale: "en",
    publishedLocaleCodes: ["en", "es"],
    imagekitBaseUrl: "https://ik.imagekit.io/hostels",
  };
}

test("links a CMS-backed organization, arbitrary brand, website, and localized page", () => {
  const graph = buildStructuredData(input())!;
  expect(graph).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.example.com/#organization",
        name: "La Puerta Hostels",
        url: "https://www.example.com/en",
        logo: "https://ik.imagekit.io/hostels/logo-puerta-simple.png",
        sameAs: ["https://instagram.com/lapuertahostels"],
        brand: { "@id": "https://www.example.com/#brand-apartments" },
      },
      {
        "@type": "Brand",
        "@id": "https://www.example.com/#brand-apartments",
        name: "La Puerta Apartments",
        url: "https://www.example.com/en/apartments",
        logo: "https://ik.imagekit.io/hostels/logo-puerta-simple.png",
      },
      {
        "@type": "WebSite",
        "@id": "https://www.example.com/#website",
        name: "La Puerta Hostels",
        url: "https://www.example.com/",
        inLanguage: ["en", "es"],
        publisher: { "@id": "https://www.example.com/#organization" },
      },
      {
        "@type": "WebPage",
        "@id": "https://www.example.com/en/apartments/rooms#webpage",
        name: "Rooms",
        url: "https://www.example.com/en/apartments/rooms",
        inLanguage: "en",
        description: "Choose your room",
        image:
          "https://ik.imagekit.io/hostels/tr:w-1200,h-630/room%20photo.jpg",
        isPartOf: { "@id": "https://www.example.com/#website" },
        publisher: { "@id": "https://www.example.com/#organization" },
        about: { "@id": "https://www.example.com/#brand-apartments" },
      },
    ],
  });
});

test("keeps entity IDs stable across locales while localizing home and page URLs", () => {
  const en = buildStructuredData(input())!["@graph"];
  const esInput = input();
  esInput.locale = "es";
  esInput.brand.rootPath = "/apartamentos";
  esInput.canonicalUrl = "https://www.example.com/es/apartamentos/habitaciones";
  const es = buildStructuredData(esInput)!["@graph"];
  expect(es.slice(0, 3).map((node) => node["@id"])).toEqual(
    en.slice(0, 3).map((node) => node["@id"]),
  );
  expect(es[1].url).toBe("https://www.example.com/es/apartamentos");
  expect(es[3]["@id"]).toBe(`${esInput.canonicalUrl}#webpage`);
});

test("supports minimal data without fabricated properties or dangling references", () => {
  const data = input();
  const graph = buildStructuredData({
    ...data,
    parentBrand: undefined,
    brand: {
      ...data.brand,
      name: " ",
      logo: "unresolved",
      rootPath: "",
      homeLink: undefined,
    },
    page: page("/"),
    footer: { id: "footer" },
  })!;
  const serialized = JSON.parse(JSON.stringify(graph));
  expect(serialized["@graph"]).toEqual([
    {
      "@type": "WebSite",
      "@id": "https://www.example.com/#website",
      url: "https://www.example.com/",
      inLanguage: ["en", "es"],
    },
    {
      "@type": "WebPage",
      "@id": "https://www.example.com/en/apartments/rooms#webpage",
      url: "https://www.example.com/en/apartments/rooms",
      inLanguage: "en",
      isPartOf: { "@id": "https://www.example.com/#website" },
    },
  ]);
});

describe("optional values", () => {
  test.each([
    undefined,
    null,
    "unresolved",
    media(""),
    { ...media("file.pdf"), mimeType: "application/pdf" },
  ])("omits unavailable media: %j", (value) => {
    const data = input();
    const nodes = buildStructuredData({
      ...data,
      page: { ...data.page, seo: { ...data.page.seo, image: value } },
      brand: { ...data.brand, logo: value ?? "unresolved" },
    })!["@graph"];
    expect(nodes[1].logo).toBeUndefined();
    expect(nodes[3].image).toBeUndefined();
  });

  test.each([
    "",
    "not a URL",
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "https://user:password@example.com",
    "https://ik.imagekit.io/hostels?query=true",
    "https://ik.imagekit.io/hostels#fragment",
  ])("omits invalid image bases: %s", (base) => {
    const nodes = buildStructuredData({ ...input(), imagekitBaseUrl: base })![
      "@graph"
    ];
    expect(nodes.every((node) => !node.logo && !node.image)).toBe(true);
  });

  test.each([
    "//other.example.com",
    "/\\other.example.com",
    "not-a-path",
    "/rooms?query=true",
  ])("omits invalid brand home paths: %s", (rootPath) => {
    const data = input();
    data.brand.rootPath = rootPath;
    expect(buildStructuredData(data)!["@graph"][1].url).toBeUndefined();
  });

  test("uses a populated legacy homeLink but omits an unresolved relationship", () => {
    const data = input();
    data.brand.rootPath = "";
    data.brand.homeLink = internalLink("/legacy");
    data.brand.homeLink.queryString = "preview=true";
    data.brand.homeLink.fragment = "rooms";
    expect(buildStructuredData(data)!["@graph"][1].url).toBe(
      "https://www.example.com/en/legacy",
    );
    data.brand.homeLink.doc = "unresolved";
    expect(buildStructuredData(data)!["@graph"][1].url).toBeUndefined();
  });

  test("omits empty descriptions and invalid social URLs, and deduplicates profiles", () => {
    const data = input();
    data.page.seo.description = " ";
    data.footer.socialLinks.push(
      data.footer.socialLinks[0],
      { platform: "instagram", link: customLink("javascript:alert(1)") },
      { platform: "instagram", link: internalLink("/contact") },
    );
    const nodes = buildStructuredData(data)!["@graph"];
    expect(nodes[0].sameAs).toEqual(["https://instagram.com/lapuertahostels"]);
    expect(nodes[3].description).toBeUndefined();
  });
});

test.each(["", "not a URL", "javascript:alert(1)"])(
  "does not generate a graph for an invalid canonical URL: %s",
  (canonicalUrl) => {
    expect(buildStructuredData({ ...input(), canonicalUrl })).toBeUndefined();
  },
);
