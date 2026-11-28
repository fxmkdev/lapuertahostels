import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { proxyAnalyticsScript } from "~/analytics-proxy.server";

export function loader({ request }: LoaderFunctionArgs) {
  return proxyAnalyticsScript(request);
}

export function action({ request }: ActionFunctionArgs) {
  return proxyAnalyticsScript(request);
}
