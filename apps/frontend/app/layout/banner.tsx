import { XMarkIcon } from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { cn } from "~/common/cn";
import { Transition } from "@headlessui/react";
import { useTheme } from "~/themes";
import { type Banner } from "@lapuertahostels/payload-types";
import { getPageLinkHref, PageLink } from "~/common/page-link";
import { useEffect, useState } from "react";
import { isObject } from "~/common/utils";

export type BannerProps = Partial<Banner>;

export function Banner({ id, message, cta }: BannerProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { isVisible, dismiss } = useBannerDismissal(
    { id, message, cta },
    i18n.language,
  );

  return (
    <Transition
      show={isVisible}
      as="div"
      className={cn(
        "flex items-center gap-x-6 px-6 py-2.5 text-sm text-white transition-colors duration-500 ease-linear sm:px-3.5 sm:before:flex-1",
        theme.bannerBackgroundColor,
      )}
      leave="transition-transform ease-out duration-500"
      leaveFrom="translate-y-0"
      leaveTo="-translate-y-full"
    >
      <div className="leading-6">
        {message}
        {cta?.show && (
          <>
            {" "}
            <span className="mx-1">&middot;</span>{" "}
            {isObject(cta?.link) && (
              <PageLink
                link={cta.link}
                className="font-bold text-nowrap after:content-['_→'] hover:underline"
              >
                {cta.label}
              </PageLink>
            )}
          </>
        )}
      </div>
      <div className="flex flex-1 justify-end">
        <button
          onClick={dismiss}
          type="button"
          className="-m-3 p-3 focus-visible:outline-offset-[-4px]"
        >
          <span className="sr-only">{t("banner.dismiss")}</span>
          <XMarkIcon className="h-5 w-5 text-white" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  );
}

function useBannerDismissal({ id, message, cta }: BannerProps, locale: string) {
  const storageKey = `lapuertahostels:banner-dismissal:v1:${JSON.stringify([id ?? null, locale])}`;
  const signature = JSON.stringify([
    message ?? "",
    Boolean(cta?.show),
    cta?.show && isObject(cta.link)
      ? [cta.label ?? "", getPageLinkHref(cta.link, locale)]
      : null,
  ]);
  const [dismissal, setDismissal] = useState<{
    key: string;
    signature: string | null;
  }>();

  useEffect(() => {
    let dismissedSignature: string | null = null;
    if (id) {
      try {
        dismissedSignature = window.localStorage.getItem(storageKey);
      } catch {
        // Storage may be blocked; dismissal still works for this mount.
      }
    }
    setDismissal({ key: storageKey, signature: dismissedSignature });
  }, [id, storageKey]);

  function dismiss() {
    setDismissal({ key: storageKey, signature });
    if (id) {
      try {
        window.localStorage.setItem(storageKey, signature);
      } catch {
        // Keep the in-memory dismissal even when storage is unavailable or full.
      }
    }
  }

  return {
    // Wait until hydration has checked storage to avoid flashing dismissed content.
    isVisible:
      dismissal?.key === storageKey && dismissal.signature !== signature,
    dismiss,
  };
}
