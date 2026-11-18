import type { PropsWithChildren } from "react";
import { cn } from "./cn";
import { useTheme } from "~/themes";

export type TextHighlightProps = PropsWithChildren<{
  variant?: "neutral" | "inherit" | "white";
}>;

export function TextHighlight({
  children,
  variant = "neutral",
}: TextHighlightProps) {
  const theme = useTheme();
  return (
    <strong
      className={cn({
        "text-neutral-900": variant === "neutral",
        [cn(theme.whiteHighlightTextColor, "font-inherit")]:
          variant === "white",
      })}
    >
      {children}
    </strong>
  );
}
