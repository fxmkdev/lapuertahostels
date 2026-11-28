import { LanguageIcon } from "@heroicons/react/16/solid";
import type { LocaleConfig } from "@lapuertahostels/payload-types";
import { cn } from "~/common/cn";
import { Dropdown, DropdownButton, DropdownItem } from "~/common/dropdown";

export type LocaleSwitcherProps = {
  currentLocale: string;
  redirectTo: string;
  className?: string;
  publishedLocales: Pick<LocaleConfig, "id" | "displayLabel">[];
};

export function LocaleSwitcher({
  currentLocale,
  redirectTo,
  className,
  publishedLocales,
}: LocaleSwitcherProps) {
  return (
    <Dropdown
      button={
        <DropdownButton
          className={cn(
            "mobile-touch-target flex items-center justify-center gap-1.5 text-sm font-bold text-neutral-500 hover:text-neutral-900",
            className,
          )}
        >
          <LanguageIcon className="h-4" />
          {publishedLocales.find((l) => l.id === currentLocale)?.displayLabel}
        </DropdownButton>
      }
      menuPosition="right"
      manual
    >
      {publishedLocales
        .filter((locale) => locale.id !== currentLocale)
        .map((locale) => (
          <form
            key={locale.id}
            method="post"
            action="/locale"
            className="contents"
          >
            <input type="hidden" name="locale" value={locale.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <DropdownItem as="button" type="submit">
              {locale.displayLabel}
            </DropdownItem>
          </form>
        ))}
    </Dropdown>
  );
}
