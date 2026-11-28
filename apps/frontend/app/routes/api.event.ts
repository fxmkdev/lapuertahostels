import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { proxyAnalyticsEvent } from "~/analytics-proxy.server";

export function loader({ request }: LoaderFunctionArgs) {
  return proxyAnalyticsEvent(request);
}

export function action({ request }: ActionFunctionArgs) {
  return proxyAnalyticsEvent(request);
}
