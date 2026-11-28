import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";
import { getCommon } from "~/cms-data.server";
import { handleIncomingRequest } from "~/common/routing.server";
import { OptInLivePreview } from "~/common/live-preview";
import { useCommonPreviewScenario } from "~/common/use-common-preview-scenario";
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
  const { scenario, setScenario } = useCommonPreviewScenario();
  return (
    <OptInLivePreview path="globals/common" data={common} depth={2}>
      {(liveCommon) => (
        <CommonPreview
          common={liveCommon}
          root={root}
          scenario={scenario}
          onScenarioChange={setScenario}
        />
      )}
    </OptInLivePreview>
  );
}
