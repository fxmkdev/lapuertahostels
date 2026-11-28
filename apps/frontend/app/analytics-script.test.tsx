import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { AnalyticsScript } from "./analytics-script";

describe("analytics snippet", () => {
  test("renders the bootstrap and one asynchronous first-party script", () => {
    const html = renderToStaticMarkup(<AnalyticsScript enabled />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const scripts = doc.querySelectorAll("script");
    expect(scripts).toHaveLength(2);
    const bootstrap = doc.querySelector("script:not([src])")!.textContent!;
    const tracker = doc.querySelector("script[src]")!;
    expect(bootstrap).toContain('endpoint:"/api/event"');
    expect(tracker.getAttribute("src")).toBe("/js/script.js");
    expect(tracker.hasAttribute("async")).toBe(true);
    expect(html).not.toContain("plausible.io");
    expect(html).not.toContain("data-domain");

    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    runInNewContext(bootstrap, sandbox);
    expect(Reflect.get(sandbox.plausible as object, "o")).toEqual({
      endpoint: "/api/event",
    });
    const init = vi.fn();
    Object.assign(sandbox, {
      plausible: Object.assign(vi.fn(), { init, l: true }),
    });
    runInNewContext(bootstrap, sandbox);
    expect(init).not.toHaveBeenCalled();
  });

  test("omits both scripts when disabled", () => {
    expect(renderToStaticMarkup(<AnalyticsScript enabled={false} />)).toBe("");
  });
});
