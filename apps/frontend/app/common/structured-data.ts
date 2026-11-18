import type {
  Brand,
  Footer,
  Media,
  Page,
} from "@lapuertahostels/payload-types";
import { toImagekitTransformationString } from "./image";
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

export function buildStructuredData({
  page,
  brand,
  parentBrand,
  footer,
  canonicalUrl,
  locale,
  publishedLocaleCodes,
  imagekitBaseUrl,
}: StructuredDataInput): StructuredData | undefined {
  const pageUrl = getPublicUrl(canonicalUrl);
  if (!pageUrl) return undefined;

  const canonical = new URL(pageUrl);
  canonical.search = "";
  canonical.hash = "";
  const origin = canonical.origin;
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  const brandId = `${origin}/#brand-${encodeURIComponent(brand.id)}`;
  const parentName = getText(parentBrand?.name);
  const brandName = getText(brand.name);
  const sameAs = getSocialProfiles(footer);
  const graph: StructuredDataNode[] = [];

  if (parentBrand && parentName) {
    graph.push({
      "@type": "Organization",
      "@id": organizationId,
      name: parentName,
      url: getBrandUrl(parentBrand, locale, origin),
      logo: getImageUrl(parentBrand.logo, imagekitBaseUrl),
      ...(sameAs.length ? { sameAs } : {}),
      ...(brandName ? { brand: { "@id": brandId } } : {}),
    });
  }

  if (brandName) {
    graph.push({
      "@type": "Brand",
      "@id": brandId,
      name: brandName,
      url: getBrandUrl(brand, locale, origin),
      logo: getImageUrl(brand.logo, imagekitBaseUrl),
    });
  }

  graph.push(
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: parentName,
      url: `${origin}/`,
      inLanguage: publishedLocaleCodes,
      ...(parentName ? { publisher: { "@id": organizationId } } : {}),
    },
    {
      "@type": "WebPage",
      "@id": `${canonical.href}#webpage`,
      url: canonical.href,
      name: getText(getPageTitle(page)),
      description: getText(page.seo?.description),
      image: getImageUrl(page.seo?.image, imagekitBaseUrl, true),
      inLanguage: locale,
      isPartOf: { "@id": websiteId },
      ...(parentName ? { publisher: { "@id": organizationId } } : {}),
      ...(brandName ? { about: { "@id": brandId } } : {}),
    },
  );

  return { "@context": "https://schema.org", "@graph": graph };
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

function getImageUrl(
  media: Media | string | null | undefined,
  imagekitBaseUrl: string,
  socialImage = false,
) {
  const baseUrl = getPublicUrl(imagekitBaseUrl);
  if (!baseUrl || typeof media !== "object" || !media?.filename?.trim()) {
    return undefined;
  }
  if (new URL(baseUrl).search || new URL(baseUrl).hash) return undefined;
  if (!media.mimeType?.startsWith("image/")) return undefined;

  const transformation = socialImage
    ? `/${toImagekitTransformationString({ width: 1200, height: 630 })}`
    : "";
  return `${baseUrl.replace(/\/$/, "")}${transformation}/${encodeURIComponent(media.filename)}`;
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
