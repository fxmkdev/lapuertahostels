import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { localeCookie } from "~/i18next.server";
import { toUrl } from "~/common/routing";
import { redirectToLocalizedRoute } from "~/common/routing.server";
import { getSettings } from "~/cms-data.server";
import type { LocaleConfig } from "@lapuertahostels/payload-types";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data(
      { message: "Method not allowed" },
      { status: 405, statusText: "Method Not Allowed" },
    );
  }

  const form = await request.formData();
  const locale = form.get("locale") as string;
  const redirectTo = form.get("redirectTo") as string;

  if (!locale) {
    return data(
      { message: "'locale' must be provided" },
      { status: 400, statusText: "Bad Request" },
    );
  }

  const publishedLocaleCodes = (
    (await getSettings(request)).publishedLocales
      .publishedLocales as LocaleConfig[]
  ).map((l) => l.id);

  if (!publishedLocaleCodes.includes(locale as LocaleConfig["id"])) {
    return data(
      { message: `Unsupported locale: ${locale}` },
      { status: 400, statusText: "Bad Request" },
    );
  }

  return await redirectToLocalizedRoute(request, toUrl(redirectTo), locale, {
    "Set-Cookie": await localeCookie.serialize(locale),
  });
}
