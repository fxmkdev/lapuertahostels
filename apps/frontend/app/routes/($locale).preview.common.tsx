import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { useTranslation } from "react-i18next";
import { getCommon } from "~/cms-data.server";
import { handleIncomingRequest } from "~/common/routing.server";
import { OptInLivePreview } from "~/common/live-preview";
import { PreviewTranslations } from "~/common/preview-translations";
import { CommonPreview } from "~/layout/common-preview";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = ({ matches }) => [
  ...matches
    .flatMap((match) => match.meta ?? [])
    .filter((entry) => !("name" in entry && entry.name === "robots")),
  { title: "Common preview" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, url }: LoaderFunctionArgs) {
  const { locale } = await handleIncomingRequest(request, url);
  if (new URL(request.url).searchParams.get("preview") !== "globals/common")
    throw new Response(null, { status: 404 });
  return { common: await getCommon(request, locale) };
}

export default function Route() {
  const { common } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root")!;
  const { i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const scenario = ["notFound", "serverError", "labels"].includes(
    params.get("scenario") ?? "",
  )
    ? params.get("scenario")!
    : "notFound";
  return (
    <OptInLivePreview path="globals/common" data={common} depth={2}>
      {(liveCommon) => (
        <PreviewTranslations key={i18n.language} common={liveCommon}>
          <CommonPreview
            common={liveCommon}
            root={root}
            scenario={scenario}
            onScenarioChange={(value) => {
              setParams(
                (current) => {
                  current.set("scenario", value);
                  return current;
                },
                { preventScrollReset: true },
              );
            }}
          />
        </PreviewTranslations>
      )}
    </OptInLivePreview>
  );
}
