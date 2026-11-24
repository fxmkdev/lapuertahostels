import { cn } from "~/common/cn";
import { useTranslation } from "react-i18next";
import { NavbarBrandLogo } from "./navbar-brand-logo";
import { LocaleSwitcher } from "./locale-switcher";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { CalendarDateRangeIcon, LanguageIcon } from "@heroicons/react/20/solid";
import type { Ref, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { Brand, LocaleConfig } from "@lapuertahostels/payload-types";
import { MobileLocaleSwitcher } from "./mobile-locale-switcher";
import type { PageLinkProps } from "~/common/page-link";
import { PageLink } from "~/common/page-link";
import { useLocation } from "react-router";
import {
  buildLocalizedRelativeUrl,
  getLocaleAndPageUrl,
  toRelativeUrl,
} from "~/common/routing";
import type { ButtonProps } from "~/common/button";
import { Button } from "~/common/button";
import { mergeRefs } from "~/common/utils";

export type NavbarProps = {
  className?: string;
  brand: Brand;
  allBrands: Brand[];
  publishedLocales: Pick<LocaleConfig, "id" | "displayLabel">[];
  onHeightChanged?: (height: number) => void;
  ref?: Ref<HTMLDivElement>;
};

const HIDE_NAVBAR_THRESHOLD = 100;

export function Navbar({
  brand,
  allBrands,
  publishedLocales,
  onHeightChanged,
  ref,
}: NavbarProps) {
  const { i18n } = useTranslation();
  const [localeSwitcherOpen, setLocaleSwitcherOpen] = useState(false);
  const [navbarFocused, setNavbarFocused] = useState(false);
  const [floatingCtaFocused, setFloatingCtaFocused] = useState(false);

  const navbarRef = useRef<HTMLDivElement>(null);
  const scrollDirection = useScrollDirection();
  const scrollY = useScrollY();
  const isScrolled = useIsScrolled(navbarRef);
  const navbarHidden =
    isScrolled &&
    scrollDirection === "down" &&
    scrollY > HIDE_NAVBAR_THRESHOLD &&
    !navbarFocused &&
    !localeSwitcherOpen;

  useElementHeightObserver(navbarRef, onHeightChanged || (() => {}));

  const navLinks = allBrands.find((b) => b.id === brand.id)?.navLinks;

  const location = useLocation();
  const { pageUrl } = getLocaleAndPageUrl(toRelativeUrl(location));
  const localeSwitcherRedirectTo = buildLocalizedRelativeUrl(null, pageUrl);

  const showLocaleSwitcher = publishedLocales.length > 1;

  return (
    <>
      <Menu
        as="nav"
        className={cn(
          "sticky inset-0 z-40 bg-white focus-within:duration-0 motion-reduce:transition-none",
          isScrolled
            ? cn(
                "shadow-md transition-transform duration-500 ease-in-out",
                navbarHidden ? "-translate-y-full" : "translate-y-0",
              )
            : "shadow-none transition-shadow duration-1000 ease-in-out",
        )}
        ref={mergeRefs(navbarRef, ref)}
        onFocusCapture={() => setNavbarFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setNavbarFocused(false);
          }
        }}
      >
        {({ open }) => (
          <>
            <div className="flex items-center justify-between gap-4 px-4 py-4 xl:grid xl:grid-cols-3">
              <NavbarBrandLogo
                className="shrink-0"
                brand={brand}
                allBrands={allBrands}
              />
              <div className="z-50 hidden max-w-[40rem] space-x-12 justify-self-center overflow-hidden text-sm font-bold text-nowrap text-neutral-500 xl:block">
                {navLinks?.map((navLink) => {
                  return (
                    <NavLink key={navLink.id} link={navLink.link}>
                      {navLink.label}
                    </NavLink>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-4">
                <div className="hidden items-center justify-center gap-4 sm:flex xl:gap-8">
                  {showLocaleSwitcher && (
                    <div className="hidden leading-none sm:inline-block">
                      <LocaleSwitcher
                        currentLocale={i18n.language}
                        redirectTo={localeSwitcherRedirectTo}
                        publishedLocales={publishedLocales}
                      />
                    </div>
                  )}
                  {brand.bookCta?.show ? (
                    <>
                      {showLocaleSwitcher && (
                        <div className="h-8 border-l border-l-neutral-300" />
                      )}
                      <BookButton cta={brand.bookCta} size="medium" />
                    </>
                  ) : null}
                </div>
                <div className="-mr-2 flex items-center xl:hidden">
                  <MenuButton className="relative inline-flex items-center justify-center rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden focus:ring-inset">
                    <span className="absolute -inset-0.5" />
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </MenuButton>
                </div>
              </div>
            </div>

            <MenuItems className="absolute z-10 w-full bg-white shadow-md xl:hidden">
              <div className="space-y-1 pt-2 pb-3">
                {navLinks?.map((navLink) => {
                  return (
                    <MenuItem
                      key={navLink.id}
                      as={PageLink}
                      link={navLink.link}
                      className="block border-l-4 border-transparent py-2 pr-4 pl-3 text-base font-bold text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                    >
                      {navLink.label}
                    </MenuItem>
                  );
                })}
              </div>
              {showLocaleSwitcher && (
                <div className="border-t border-neutral-200 pt-4 pb-3 sm:hidden">
                  <div className="space-y-1">
                    <MenuItem
                      as="button"
                      onClick={() => setLocaleSwitcherOpen(true)}
                      className="flex w-full items-center gap-1.5 border-l-4 border-transparent py-2 pr-4 pl-3 text-base font-bold text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                    >
                      <LanguageIcon className="h-5" />
                      {
                        publishedLocales.find((l) => l.id === i18n.language)
                          ?.displayLabel
                      }
                    </MenuItem>
                  </div>
                </div>
              )}
            </MenuItems>
            {showLocaleSwitcher && (
              <MobileLocaleSwitcher
                currentLocale={i18n.language}
                publishedLocales={publishedLocales}
                onClose={() => setLocaleSwitcherOpen(false)}
                open={localeSwitcherOpen}
                redirectTo={localeSwitcherRedirectTo}
              />
            )}
          </>
        )}
      </Menu>
      {brand.bookCta?.show ? (
        <BookButton
          cta={brand.bookCta}
          size="floating-action-button"
          className={cn(
            "visible fixed right-6 bottom-6 z-50 translate-y-0 opacity-100 transition-[opacity,translate,visibility] delay-0 duration-200 ease-out motion-reduce:transition-none",
            // Wait for the navbar to return before fading out. Visibility keeps
            // the CTA interactive until the exit finishes.
            !navbarHidden &&
              !floatingCtaFocused &&
              "sm:invisible sm:translate-y-2 sm:opacity-0 sm:delay-500 sm:duration-150 sm:ease-in sm:motion-reduce:delay-0",
          )}
          onFocus={() => setFloatingCtaFocused(true)}
          onBlur={() => setFloatingCtaFocused(false)}
        />
      ) : null}
    </>
  );
}

type NavLinkProps = PageLinkProps;

function NavLink({ className, ...props }: NavLinkProps) {
  return (
    <PageLink className={cn("hover:text-neutral-900", className)} {...props} />
  );
}

function useElementHeightObserver(
  ref: RefObject<HTMLElement | null>,
  onHeightChanged: (height: number) => void,
) {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChanged(entry.borderBoxSize[0].blockSize);
      }
    });
    observer.observe(ref.current, { box: "border-box" });

    return () => observer.disconnect();
  }, [onHeightChanged, ref]);
}

type BookButtonProps = {
  cta: NonNullable<Brand["bookCta"]>;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonProps, "children" | "variant" | "icon" | "as">;

function BookButton({ cta, ref, ...props }: BookButtonProps) {
  return (
    <Button
      {...props}
      as={PageLink}
      icon={CalendarDateRangeIcon}
      link={cta.link!}
      variant="primary"
      ref={ref}
    >
      {cta.label}
    </Button>
  );
}

type ScrollDirection = "up" | "down";

function useScrollDirection(): ScrollDirection | undefined {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>();
  const isNavigating = useRef(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    function onScroll() {
      try {
        if (isNavigating.current) return;

        if (window.scrollY > lastScrollY) {
          setScrollDirection("down");
        } else if (window.scrollY < lastScrollY) {
          setScrollDirection("up");
        }
      } finally {
        lastScrollY = window.scrollY;
      }
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When detecting navigation, reset scroll direction and block scroll events for a short time to avoid
  // confusing scroll direction changes due to scroll events upon navigation (e.g. when navigating to a fragment link)
  const location = useLocation();
  const timeoutRef = useRef<number>(undefined);
  useEffect(() => {
    setScrollDirection(undefined);
    isNavigating.current = true;

    cleanup();
    timeoutRef.current = window.setTimeout(
      () => (isNavigating.current = false),
      100,
    );

    return () => cleanup();

    function cleanup() {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    }
  }, [location.key]);

  return scrollDirection;
}

function useScrollY(): number {
  const [scrollY, setScrollY] = useState(
    typeof window !== "undefined" ? window.scrollY : 0,
  );
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrollY;
}

function useIsScrolled(ref: RefObject<HTMLDivElement | null>): boolean {
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return;

      // Using a threshold as these might not match exactly when scroll bounces
      const THRESHOLD_IN_PX = 1;
      setIsScrolled(
        window.scrollY > THRESHOLD_IN_PX &&
          Math.abs(window.scrollY - ref.current.offsetTop) <= THRESHOLD_IN_PX,
      );
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);

  return isScrolled;
}
