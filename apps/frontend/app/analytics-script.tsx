import { ANALYTICS_EVENT_PATH, ANALYTICS_SCRIPT_PATH } from "./analytics";

const bootstrap = `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};if(!plausible.l)plausible.init({endpoint:${JSON.stringify(ANALYTICS_EVENT_PATH)}});`;

export function AnalyticsScript({ enabled }: { enabled: boolean }) {
  return (
    enabled && (
      <>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
        <script async src={ANALYTICS_SCRIPT_PATH} />
      </>
    )
  );
}
