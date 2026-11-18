import type { SVGProps } from "react";
import { cn } from "../cn";

export function SpinnerIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      {...props}
    >
      <path
        d="m1,12C1,5.92,5.92,1,12,1"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
