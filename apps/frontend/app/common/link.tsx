import type { LinkProps as ReactRouterLinkProps } from "react-router";
import { Link as ReactRouterLink } from "react-router";
import type { Ref } from "react";

export type LinkProps = Omit<ReactRouterLinkProps, "to"> & {
  ref?: Ref<HTMLAnchorElement>;
  to: string;
};

export function Link({ to, children, ...props }: LinkProps) {
  const isExternal = to.startsWith("http://") || to.startsWith("https://");
  return (
    <ReactRouterLink
      to={to}
      {...props}
      {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </ReactRouterLink>
  );
}
