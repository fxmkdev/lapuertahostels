import type { Brand, Footer, Page } from "@lapuertahostels/payload-types";
import { getMediaImageUrl } from "./media";
import { getPageTitle } from "./meta";
import { getBrandHomeHref } from "./page-link";

type Reference = { "@id": string };

type StructuredDataNode = {
  "@id": string;
  "@type": "Organization" | "Brand" | "WebSite" | "WebPage";
  name?: string;
  url?: string;
  logo?: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  inLanguage?: string | string[];
  brand?: Reference;
  publisher?: Reference;
  isPartOf?: Reference;
  about?: Reference;
};

export type StructuredData = {
  "@context": "https://schema.org";
  "@graph": StructuredDataNode[];
};

type StructuredDataInput = {
  page: Page;
  brand: Brand;
  parentBrand?: Brand;
  footer: Footer;
  canonicalUrl: string;
  locale: string;
  publishedLocaleCodes: string[];
  imagekitBaseUrl: string;
};

export function buildStructuredData(
  input: StructuredDataInput,
): StructuredData | undefined {
  const pageUrl = getPublicUrl(input.canonicalUrl);
  if (!pageUrl) return undefined;

  const canonical = new URL(pageUrl);
  canonical.search = "";
  canonical.hash = "";
  const origin = canonical.origin;
  const websiteId = `${origin}/#website`;
  const brand = buildBrandNode(input, origin);
  const about = brand ? { "@id": brand["@id"] } : undefined;
  const organization = buildOrganizationNode(input, origin, about);
  const publisher = organization ? { "@id": organization["@id"] } : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...(organization ? [organization] : []),
      ...(brand ? [brand] : []),
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: getText(input.parentBrand?.name),
        url: `${origin}/`,
        inLanguage: input.publishedLocaleCodes,
        publisher,
      },
      {
        "@type": "WebPage",
        "@id": `${canonical.href}#webpage`,
        url: canonical.href,
        name: getText(getPageTitle(input.page)),
        description: getText(input.page.seo?.description),
        image: getMediaImageUrl(input.page.seo?.image, input.imagekitBaseUrl, {
          width: 1200,
          height: 630,
        }),
        inLanguage: input.locale,
        isPartOf: { "@id": websiteId },
        publisher,
        about,
      },
    ],
  };
}

function buildOrganizationNode(
  input: StructuredDataInput,
  origin: string,
  brand: Reference | undefined,
): StructuredDataNode | undefined {
  const name = getText(input.parentBrand?.name);
  if (!input.parentBrand || !name) return undefined;
  const sameAs = getSocialProfiles(input.footer);

  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name,
    url: getBrandUrl(input.parentBrand, input.locale, origin),
    logo: getMediaImageUrl(input.parentBrand.logo, input.imagekitBaseUrl),
    ...(sameAs.length ? { sameAs } : {}),
    brand,
  };
}

function buildBrandNode(
  input: StructuredDataInput,
  origin: string,
): StructuredDataNode | undefined {
  const name = getText(input.brand.name);
  if (!name) return undefined;

  return {
    "@type": "Brand",
    "@id": `${origin}/#brand-${encodeURIComponent(input.brand.id)}`,
    name,
    url: getBrandUrl(input.brand, input.locale, origin),
    logo: getMediaImageUrl(input.brand.logo, input.imagekitBaseUrl),
  };
}

function getText(value: string | null | undefined) {
  return value?.trim() || undefined;
}

function getPublicUrl(value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function getBrandUrl(brand: Brand, locale: string, origin: string) {
  // An unresolved homeLink must not silently become the site's home page.
  const pathname =
    brand.rootPath?.trim() ||
    (brand.homeLink?.linkType === "internal" &&
    typeof brand.homeLink.doc === "object"
      ? brand.homeLink.doc?.pathname
      : undefined);
  if (!pathname || !/^\/(?!\/)/.test(pathname) || /[\\?#]/.test(pathname)) {
    return undefined;
  }
  const url = new URL(getBrandHomeHref(brand, locale), origin);
  url.search = "";
  url.hash = "";
  return url.href;
}

function getSocialProfiles(footer: Footer) {
  return [
    ...new Set(
      (footer.socialLinks ?? []).flatMap(({ platform, link }) => {
        // WhatsApp links start conversations; they do not identify the organization.
        if (platform === "whatsapp" || link?.linkType !== "custom") return [];
        const url = getPublicUrl(link.url);
        return url ? [url] : [];
      }),
    ),
  ];
}
