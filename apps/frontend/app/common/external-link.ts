import type { ExternalLinkOptions } from "@lapuertahostels/rich-text";

export function getExternalLinkAttributes(
  to: string,
  options: ExternalLinkOptions | null | undefined,
  defaults = { newTab: true, suppressReferrer: true },
) {
  if (!to.startsWith("http://") && !to.startsWith("https://")) return {};

  const newTab = resolve(options?.openInNewTab, defaults.newTab);
  const suppressReferrer = resolve(
    options?.suppressReferrer,
    defaults.suppressReferrer,
  );
  return {
    target: newTab ? "_blank" : undefined,
    rel: [
      "noopener",
      suppressReferrer && "noreferrer",
      options?.noFollow && "nofollow",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function resolve(
  value: ExternalLinkOptions["openInNewTab"],
  fallback: boolean,
) {
  return value === "yes" ? true : value === "no" ? false : fallback;
}
