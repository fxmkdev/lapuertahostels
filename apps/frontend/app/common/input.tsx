import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type InputProps = ComponentPropsWithoutRef<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        "mobile-touch-target focus:ring-puerta-600 w-full appearance-none rounded-md border-0 bg-white px-3 py-1.5 text-base text-neutral-900 shadow-xs ring-1 ring-neutral-300 ring-inset placeholder:text-neutral-400 focus:ring-2 focus:ring-inset md:w-56 md:min-w-0 md:text-sm md:leading-6",
        className,
      )}
    />
  );
}
