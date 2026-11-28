export const ANALYTICS_SCRIPT_PATH = "/js/script.js";
export const ANALYTICS_EVENT_PATH = "/api/event";

export function isAnalyticsProxyPath(pathname: string) {
  return (
    pathname === ANALYTICS_SCRIPT_PATH || pathname === ANALYTICS_EVENT_PATH
  );
}
