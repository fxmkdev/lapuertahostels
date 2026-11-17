import type { Endpoint, PayloadRequest } from "payload";

import { addLocalesToRequestFromData } from "payload";

export const getLocalizedPathnameEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return new Response(null, { status: 401, statusText: "Unauthorized" });
    }

    const pathname = req.searchParams.get("pathname");
    addLocalesToRequestFromData(req);

    if (!pathname || !req.locale) {
      return new Response(
        JSON.stringify({
          message: "'pathname' and 'locale' are required.",
        }),
        { status: 400, statusText: "Bad Request" },
      );
    }

    const localizedPathname = await getLocalizedPathname(req, pathname);

    if (localizedPathname === null) {
      return new Response(null, { status: 404, statusText: "Not Found" });
    }

    return new Response(JSON.stringify({ localizedPathname }), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  },
  method: "get",
  path: "/localized-pathname",
};

async function getLocalizedPathname(
  req: PayloadRequest,
  pathnameToFind: string,
) {
  const pages = await getPagesForPathname(req, pathnameToFind);
  return pages.length > 0 ? pages[0].pathname : null;
}

export async function getPagesForPathname(
  req: PayloadRequest,
  pathnameToFind: string,
) {
  const settings = await req.payload.findGlobal({
    slug: "settings",
    req,
    select: {
      publishedLocales: {
        publishedLocales: true,
      },
    },
  });
  const result = await req.payload.find({
    collection: "pages",
    limit: 1,
    pagination: false,
    req,
    where: {
      or: (
        (settings.publishedLocales as Record<string, unknown>)
          .publishedLocales as { id: string }[]
      ).map((l) => ({
        [`pathname.${l.id}`]: { equals: pathnameToFind },
      })),
    },
  });

  return result.docs;
}
