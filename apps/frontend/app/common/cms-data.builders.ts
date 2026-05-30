import { createId } from "@paralleldrive/cuid2";
import {
  Banner,
  Brand,
  LeadText,
  Media,
  NewLink,
  Page,
  RoomList,
} from "@lapuertahostels/payload-types";

export function brand(values: Partial<Brand> = {}): Brand {
  return {
    ...values,
    id: values.id ?? createId(),
    name: values.name ?? "La Puerta Hostels",
    homeLink: values.homeLink ?? internalLink("/"),
    rootPath: values.rootPath ?? "/",
    navLinks: values.navLinks ?? [],
    logo: values.logo ?? media("logo-puerta-simple.png"),
    createdAt: date,
    updatedAt: date,
  };
}

export function media(filename: string, altText?: string): Media {
  return {
    id: createId(),
    mimeType: "image/jpeg",
    filename,
    alt: altText ?? "Puerta Aqua",
    createdAt: date,
    updatedAt: date,
  };
}

type CallToAction = NonNullable<LeadText["cta"]>;

export function callToAction(
  label: string,
  variant?: CallToAction["variant"],
): CallToAction {
  return {
    show: true,
    label,
    link: customLink("http://example.com/"),
    variant: variant ?? "secondary",
  };
}

type CallToAction2 = NonNullable<Banner["cta"]>;

export function callToAction2(label: string): CallToAction2 {
  return {
    show: true,
    label,
    link: customLink("http://example.com/"),
  };
}

type RequiredCallToAction = NonNullable<RoomList["rooms"][number]["cta"]>;

export function requiredCallToAction(
  label: string,
  variant?: CallToAction["variant"],
): RequiredCallToAction {
  return {
    show: true,
    label,
    link: customLink("http://example.com/"),
    variant: variant ?? "secondary",
  };
}

export function internalLink(pageUrl?: string): NewLink {
  return {
    linkType: "internal",
    doc: page(pageUrl ?? "/"),
  };
}

export function customLink(url: string): NewLink {
  return {
    linkType: "custom",
    url,
  };
}

export function page(pathname: string): Page {
  return {
    id: createId(),
    pathname,
    brand: null as unknown as Brand,
    createdAt: date,
    updatedAt: date,
  };
}

export function banner(message: string, ctaLabel?: string): Banner {
  return {
    id: createId(),
    createdAt: date,
    updatedAt: date,
    message: message ?? "Travel before 20 September and get 20% off!",
    cta: callToAction2(ctaLabel ?? "Book Now"),
  };
}

const date = new Date().toISOString();
