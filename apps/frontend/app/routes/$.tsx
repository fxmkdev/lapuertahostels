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
import { toImagekitTransformationString } from "~/common/image";
import { getAltFromMedia } from "~/common/media";
import { PAGE_DEPTH } from "~/cms-data";
import { getSettings, tryGetLocalizedPathname } from "~/cms-data.server";
import type { LocaleConfig } from "@lapuertahostels/payload-types";
import { buildStructuredData } from "~/common/structured-data";

export const meta: MetaFunction<typeof loader> = ({
  loaderData,
  matches,
  error,
}) => {
  if (error || !loaderData) return [];

  const rootLoaderData = matches.find((m) => m.id === "root")
    ?.loaderData as SerializeFromLoader<typeof rootLoader>;
  if (!rootLoaderData) throw new Error("No root loader data");

  const parentMeta = matches.flatMap((match) => match.meta ?? []);

  const description = loaderData.content.seo?.description ?? "";
  const structuredData = loaderData.includeStructuredData
    ? buildStructuredData({
        page: loaderData.content,
        brand: rootLoaderData.brand,
        parentBrand: rootLoaderData.allBrands.find((b) => b.id === "puerta"),
        footer: rootLoaderData.footer,
        canonicalUrl: loaderData.canonicalUrl,
        locale: rootLoaderData.locale,
        publishedLocaleCodes: loaderData.publishedLocaleCodes,
        imagekitBaseUrl: rootLoaderData.environment.imagekitBaseUrl,
      })
    : undefined;
  return [
    ...parentMeta,
    ...(structuredData ? [{ "script:ld+json": structuredData }] : []),
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
      content: getSocialImageUrl(data, rootLoaderData, 2400, 1200),
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

  const width = 1200;
  const height = 630;

  return [
    {
      name: "og:image",
      content: getSocialImageUrl(data, rootLoaderData, width, height),
    },
    {
      name: "og:image:alt",
      content: getAltFromMedia(image) ?? "",
    },
    { name: "og:image:type", content: image.mimeType ?? "" },
    { name: "og:image:width", content: width.toString() },
    { name: "og:image:height", content: height.toString() },
  ];
}

function getSocialImageUrl(
  data: SerializeFromLoader<typeof loader>,
  rootLoaderData: SerializeFromLoader<typeof rootLoader>,
  width: number,
  height: number,
) {
  const image = data.content.seo?.image;
  if (typeof image !== "object") {
    throw new Error("Invalid image");
  }

  if (!image) return "";

  return `${rootLoaderData.environment.imagekitBaseUrl.toString()}/${toImagekitTransformationString({ width, height })}/${image.filename}`;
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

  const canonicalUrl = getCanonicalRequestUrl(request, url);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";

  return {
    origin: requestUrl.origin,
    canonicalUrl: canonicalUrl.href,
    includeStructuredData:
      !requestUrl.searchParams.has("preview") &&
      !settings.maintenanceScreen?.show,
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
