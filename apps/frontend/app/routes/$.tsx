import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { OptInLivePreview } from "~/common/live-preview";
import { Page } from "../layout/page";
import { getPageTitle } from "~/common/meta";
import { handleIncomingRequest, handlePathname } from "~/common/routing.server";
import {
  buildLocalizedRelativeUrl,
  getCanonicalRequestUrl,
  getRequestUrl,
  toUrl,
} from "~/common/routing";
import type { SerializeFromLoader } from "~/common/types";
import { type loader as rootLoader } from "~/root";
import { getAltFromMedia, getSocialImage } from "~/common/media";
import { PAGE_DEPTH } from "~/cms-data";
import { getSettings, tryGetLocalizedPathname } from "~/cms-data.server";
import type { LocaleConfig } from "@lapuertahostels/payload-types";

export const meta: MetaFunction<typeof loader> = ({ loaderData, matches }) => {
  if (!loaderData) throw new Error("No loader data");

  const rootLoaderData = matches.find((m) => m.id === "root")
    ?.loaderData as SerializeFromLoader<typeof rootLoader>;
  if (!rootLoaderData) throw new Error("No root loader data");

  const parentMeta = matches.flatMap((match) => match.meta ?? []);

  const description = loaderData.content.seo?.description ?? "";
  return [
    ...parentMeta,
    ...loaderData.alternateUrls.map((alternateUrl) => ({
      tagName: "link",
      rel: "alternate",
      href: alternateUrl.href,
      hrefLang: alternateUrl.hrefLang,
    })),
    {
      tagName: "link",
      rel: "canonical",
      href: loaderData.canonicalUrl,
    },
    { title: getPageTitle(loaderData.content) },
    {
      name: "description",
      content: description,
    },
    {
      name: "og:title",
      content: getPageTitle(loaderData.content),
    },
    {
      name: "og:description",
      content: description,
    },
    {
      name: "og:locale",
      content: rootLoaderData.locale,
    },
    ...loaderData.publishedLocaleCodes
      .filter((lng) => lng !== rootLoaderData.locale)
      .map((lng) => ({
        name: "og:locale:alternate",
        content: lng,
      })),
    {
      name: "og:type",
      content: "website",
    },
    {
      name: "og:site_name",
      content: rootLoaderData.allBrands.find((b) => b.id === "puerta")!.name,
    },
    {
      name: "og:url",
      content: loaderData.canonicalUrl,
    },
    ...getOpenGraphImageMeta(loaderData, rootLoaderData),
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: getPageTitle(loaderData.content),
    },
    {
      name: "twitter:description",
      content: description,
    },
    ...getTwitterCardImageMeta(loaderData, rootLoaderData),
  ];
};

function getTwitterCardImageMeta(
  data: SerializeFromLoader<typeof loader>,
  rootLoaderData: SerializeFromLoader<typeof rootLoader>,
): { name: string; content: string }[] {
  const image = data.content.seo?.image;
  if (!image) {
    return [];
  }

  if (typeof image !== "object") {
    throw new Error("Invalid image");
  }

  return [
    {
      name: "twitter:image",
      content: getSocialImage(
        image,
        rootLoaderData.environment.mediaBaseUrl,
        "twitter",
        rootLoaderData.environment.mediaUseDerivatives,
      ).url,
    },
    {
      name: "twitter:image:alt",
      content: getAltFromMedia(image) ?? "",
    },
  ];
}

function getOpenGraphImageMeta(
  data: SerializeFromLoader<typeof loader>,
  rootLoaderData: SerializeFromLoader<typeof rootLoader>,
): { name: string; content: string }[] {
  const image = data.content.seo?.image;
  if (!image) {
    return [];
  }

  if (typeof image !== "object") {
    throw new Error("Invalid image");
  }

  const social = getSocialImage(
    image,
    rootLoaderData.environment.mediaBaseUrl,
    "opengraph",
    rootLoaderData.environment.mediaUseDerivatives,
  );

  return [
    {
      name: "og:image",
      content: social.url,
    },
    {
      name: "og:image:alt",
      content: getAltFromMedia(image) ?? "",
    },
    { name: "og:image:type", content: social.mimeType ?? "" },
    { name: "og:image:width", content: social.width?.toString() ?? "" },
    { name: "og:image:height", content: social.height?.toString() ?? "" },
  ];
}

export async function loader({ request, url }: LoaderFunctionArgs) {
  const { pageUrl, locale } = await handleIncomingRequest(request, url);

  const requestUrl = getRequestUrl(request, url);

  const content = await handlePathname(
    request,
    toUrl(pageUrl).pathname,
    locale,
  );
  if (!content) {
    throw new Response(null, { status: 404, statusText: "Not Found" });
  }
  const dataPath = `pages/${content.id}`;
  const settings = await getSettings(request);
  const publishedLocaleCodes = (
    settings.publishedLocales.publishedLocales as LocaleConfig[]
  ).map((l) => l.id);
  const alternateUrlsByLocale = await getAlternateHrefsByLocale(
    request,
    content.pathname,
    publishedLocaleCodes,
    url,
  );

  const fallbackLocaleCode = (
    settings.publishedLocales.fallbackLocale as LocaleConfig
  ).id;

  return {
    origin: requestUrl.origin,
    canonicalUrl: getCanonicalRequestUrl(request, url).href,
    pageUrl,
    dataPath,
    content,
    publishedLocaleCodes,
    fallbackLocaleCode,
    alternateUrls: [
      ...Object.entries(alternateUrlsByLocale).map(([locale, href]) => ({
        href,
        hrefLang: locale,
      })),
      {
        href: alternateUrlsByLocale[fallbackLocaleCode],
        hrefLang: "x-default",
      },
    ],
  };
}

export default function Route() {
  const { dataPath, content } = useLoaderData<typeof loader>();

  return (
    <OptInLivePreview path={dataPath} data={content} depth={PAGE_DEPTH}>
      {(data) => <Page content={data} />}
    </OptInLivePreview>
  );
}

async function getAlternateHrefsByLocale(
  request: Request,
  pathname: string,
  publishedLocaleCodes: string[],
  routeUrl: URL,
) {
  return Object.fromEntries(
    await Promise.all(
      publishedLocaleCodes.map(async (lng) => {
        const localizedPathname = await tryGetLocalizedPathname(
          request,
          pathname,
          lng,
        );
        if (!localizedPathname) {
          throw new Error("Localized pathname not found");
        }
        const requestUrl = getRequestUrl(request, routeUrl);
        requestUrl.pathname = buildLocalizedRelativeUrl(lng, localizedPathname);
        return [lng, requestUrl.toString()];
      }),
    ),
  );
}
