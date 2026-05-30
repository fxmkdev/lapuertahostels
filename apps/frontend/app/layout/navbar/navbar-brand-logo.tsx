import { Transition } from "@headlessui/react";
import { ReactNode } from "react";
import { BrandLogo } from "~/common/brand-logo";
import { cn } from "~/common/cn";
import { getBrandHomeHref } from "~/common/page-link";
import { Brand } from "@lapuertahostels/payload-types";
import { Link } from "~/common/link";
import { useTranslation } from "react-i18next";

export type NavbarBrandLogoProps = {
  brand: Brand;
  allBrands: Brand[];
  className?: string;
};

export function NavbarBrandLogo({
  allBrands,
  brand,
  className,
}: NavbarBrandLogoProps) {
  const { i18n } = useTranslation();

  function getComponent(children: ReactNode) {
    const href = getBrandHomeHref(brand, i18n.language);
    return href !== "about:blank" ? (
      <Link to={href}>{children}</Link>
    ) : (
      <div>{children}</div>
    );
  }
  return (
    <h1 className={cn("h-10", className)}>
      {getComponent(
        allBrands.map((b) => (
          <Transition
            key={b.id}
            as="span"
            className="block"
            show={b.id === brand.id}
            enter="transition ease-out duration-500"
            enterFrom="-translate-x-3/4 opacity-0"
            enterTo="translate-x-0 opacity-100"
            leave="hidden"
          >
            <BrandLogo size="large" type="with-wordmark" brand={brand} />
          </Transition>
        )),
      )}
    </h1>
  );
}
