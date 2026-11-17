import { getSettings, loadData } from "~/cms-data.server";
import {
  buildLocalizedRelativeUrl,
  getCanonicalRequestUrl,
} from "~/common/routing";
import type { LoaderFunctionArgs } from "react-router";
import { isAuthenticated } from "~/common/auth";
import type { LocaleConfig } from "@lapuertahostels/payload-types";

export async function loader({ request }: LoaderFunctionArgs) {
  const settings = await getSettings(request);
  if (settings.maintenanceScreen?.show && !(await isAuthenticated(request))) {
    throw new Response(null, {
      status: 401,
      statusText: "Unauthorized",
    });
  }

  const [pages] = await Promise.all([getAllPages()]);

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${(settings.publishedLocales.publishedLocales as LocaleConfig[])
      .flatMap((l) =>
        pages.map(
          (p) => `  <url>
    <loc>${getCanonicalRequestUrl(request).origin}${buildLocalizedRelativeUrl(l.id, p.pathname[l.id])}</loc>
    <lastmod>${p.updatedAt.split("T")[0]}</lastmod>
  </url>`,
        ),
      )
      .join("\n")}
</urlset>`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      encoding: "UTF-8",
    },
  });
}

async function getAllPages() {
  return (await loadData(`pages`, "all", 0, {})).docs as {
    pathname: Record<string, string>;
    updatedAt: string;
  }[];
}
