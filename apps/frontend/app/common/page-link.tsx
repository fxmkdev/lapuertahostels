import { Brand, NewLink } from "@lapuertahostels/payload-types";
import { Link, LinkProps } from "./link";
import { PropsWithChildren } from "react";
import { gracefully, isObject } from "./utils";
import { buildLocalizedRelativeUrl } from "./routing";
import { useTranslation } from "react-i18next";

export type PageLinkProps = {
  link?: NewLink | null;
} & Omit<PropsWithChildren<LinkProps>, "to">;

export function PageLink({ link, ...props }: PageLinkProps) {
  const { i18n } = useTranslation();
  return (
    <Link
      {...props}
      to={isObject(link) ? getPageLinkHref(link, i18n.language) : "about:blank"}
    />
  );
}

type PageLinkData = Pick<
  NewLink,
  "linkType" | "doc" | "queryString" | "fragment" | "url"
>;

export function getPageLinkHref(linkData: PageLinkData, locale: string) {
  return linkData.linkType === "internal"
    ? buildLocalizedRelativeUrl(
        locale,
        `${gracefully(linkData.doc, "pathname") ?? ""}${linkData.queryString ? `?${linkData.queryString}` : ""}${linkData.fragment ? `#${linkData.fragment}` : ""}`,
      )
    : (linkData.url ?? "about:blank");
}

export function getBrandHomeHref(brand: Brand, locale: string) {
  if (typeof brand.rootPath === "string" && brand.rootPath.trim()) {
    return buildLocalizedRelativeUrl(locale, brand.rootPath);
  }

  return isObject(brand.homeLink)
    ? getPageLinkHref(brand.homeLink, locale)
    : "about:blank";
}
