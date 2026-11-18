import { redirect } from "react-router";
import { getRequestLocale } from "~/i18next.server";
import {
  getLocaleAndPageUrl,
  toRelativeUrl,
  getRequestUrl,
  buildLocalizedRelativeUrl,
  getCanonicalRequestUrl,
} from "./routing";
import {
  getSettings,
  tryGetLocalizedPathname,
  tryGetPage,
  tryGetRedirect,
} from "~/cms-data.server";
import { isAuthenticated } from "./auth";
import { getPageLinkHref } from "./page-link";

export async function handleIncomingRequest(request: Request, routeUrl?: URL) {
  const url = getRequestUrl(request, routeUrl);

  redirectIfBrandSubdomain(url, "aqua");
  redirectIfBrandSubdomain(url, "azul");

  redirectIfNonCanonicalHostname(request, routeUrl);
  redirectIfPathnameEndsWithSlash(url);

  const { locale, pageUrl } = getLocaleAndPageUrl(toRelativeUrl(url));

  if (!locale) {
    const locale = await getRequestLocale(request);
    await redirectToLocalizedRoute(request, url, locale);
  }

  // TypeScript doesn't recognize that the awaited `redirectToLocalizedRoute` never returns
  if (!locale) throw new Error();

  const settings = await getSettings(request, locale!);
  if (
    settings.maintenanceScreen?.show &&
    !(await isAuthenticated(request)) &&
    pageUrl !== "/login"
  ) {
    throw new Response(null, {
      status: 503,
      statusText: "Service Unavailable",
    });
  }

  return { locale, pageUrl };
}

function redirectIfBrandSubdomain(url: URL, brandName: string) {
  const domainPrefix = `${brandName}.`;
  if (url.hostname.startsWith(domainPrefix)) {
    url.hostname = url.hostname.replace(domainPrefix, "");
    url.pathname = `/${brandName}${url.pathname === "/" ? "" : url.pathname}`;
    throw redirect(url.href);
  }
}

function redirectIfNonCanonicalHostname(request: Request, routeUrl?: URL) {
  const canonicalRequestUrl = getCanonicalRequestUrl(request, routeUrl);
  if (
    getRequestUrl(request, routeUrl).hostname !== canonicalRequestUrl.hostname
  ) {
    throw redirect(canonicalRequestUrl.href, { status: 301 });
  }
}

function redirectIfPathnameEndsWithSlash(url: URL) {
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
    throw redirect(toRelativeUrl(url), { status: 301 });
  }
}

export async function redirectToLocalizedRoute(
  request: Request,
  url: URL,
  locale: string,
  headers?: Record<string, string>,
): Promise<never> {
  const localizedPagePathname = await tryGetLocalizedPathname(
    request,
    url.pathname,
    locale,
  );
  if (localizedPagePathname) {
    url.pathname = localizedPagePathname;
    throw redirect(buildLocalizedRelativeUrl(locale, toRelativeUrl(url)), {
      headers: { ...headers },
    });
  }

  // route is not a page pathname, just redirect it as-is (e.g. '/login')
  throw redirect(buildLocalizedRelativeUrl(locale, toRelativeUrl(url)), {
    headers: { ...headers },
  });
}

export async function handlePathname(
  request: Request,
  pathname: string,
  locale: string,
) {
  const content = await tryGetPage(request, pathname, locale);
  if (content) return content;

  const redirectObj = await tryGetRedirect(request, pathname, locale);
  if (redirectObj && redirectObj.to) {
    throw redirect(
      getPageLinkHref(
        {
          linkType: "internal",
          doc: redirectObj.to.page,
          queryString: redirectObj.to.queryString,
          fragment: redirectObj.to.fragment,
        },
        locale,
      ),
      { status: 301 },
    );
  }

  throw new Response(null, { status: 404, statusText: "Not Found" });
}
