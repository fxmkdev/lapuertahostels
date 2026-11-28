import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { Button } from "~/common/button";
import { getLocaleAndPageUrl, toRelativeUrl, toUrl } from "~/common/routing";
import type { LanguageSuggestion as Suggestion } from "~/language-suggestion";

export function isLanguageOfferArrival(
  referrer: string,
  origin: string,
  navigationType?: string,
) {
  if (navigationType === "reload" || navigationType === "back_forward")
    return false;
  if (!referrer) return true;
  try {
    return new URL(referrer).origin !== origin;
  } catch {
    return false;
  }
}

const LanguageOfferArrivalContext = createContext(false);

// The document Layout survives screen errors, so returning from one cannot rearm an offer.
export function LanguageOfferArrivalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const [initialKey] = useState(location.key);
  const initialized = useRef(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const navigation = performance.getEntriesByType?.("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (
      isLanguageOfferArrival(
        document.referrer,
        window.location.origin,
        navigation?.type,
      )
    )
      setEligible(true);
  }, []);

  useEffect(() => {
    if (location.key !== initialKey) setEligible(false);
  }, [location.key, initialKey]);

  useEffect(() => {
    const clear = () => setEligible(false);
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);

  return (
    <LanguageOfferArrivalContext
      value={eligible && location.key === initialKey}
    >
      {children}
    </LanguageOfferArrivalContext>
  );
}

export function LanguageSuggestion({
  suggestion,
}: {
  suggestion?: Suggestion;
}) {
  const location = useLocation();
  const eligible = useContext(LanguageOfferArrivalContext);
  const offer = suggestion;

  if (!eligible || !offer) return null;

  const { locale: currentLocale, pageUrl } = getLocaleAndPageUrl(
    toRelativeUrl(location),
  );
  const destination = toUrl(pageUrl);
  destination.pathname = offer.pathname;

  return (
    <aside
      lang={offer.locale}
      aria-label={offer.message}
      className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>{offer.message}</p>
        <div className="flex flex-wrap gap-3">
          <form method="post" action="/locale">
            <input
              type="hidden"
              name="redirectTo"
              value={toRelativeUrl(destination)}
            />
            <input type="hidden" name="locale" value={offer.locale} />
            <Button type="submit" size="small" variant="primary">
              {offer.switch}
            </Button>
          </form>
          <form method="post" action="/locale">
            <input type="hidden" name="redirectTo" value={pageUrl || "/"} />
            <input type="hidden" name="locale" value={currentLocale} />
            <Button type="submit" size="small">
              {offer.keep}
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
