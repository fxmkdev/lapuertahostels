import type { LinkProps as ReactRouterLinkProps } from "react-router";
import { Link as ReactRouterLink } from "react-router";
import type { Ref } from "react";

import type { ExternalLinkOptions } from "@lapuertahostels/rich-text";
import { getExternalLinkAttributes } from "./external-link";

export type LinkProps = Omit<ReactRouterLinkProps, "to"> & {
  ref?: Ref<HTMLAnchorElement>;
  to: string;
  externalLinkOptions?: ExternalLinkOptions | null;
};

export function Link({
  to,
  children,
  externalLinkOptions,
  ...props
}: LinkProps) {
  return (
    <ReactRouterLink
      to={to}
      {...props}
      {...getExternalLinkAttributes(to, externalLinkOptions)}
    >
      {children}
    </ReactRouterLink>
  );
}
