import type {
  ComponentPropsWithoutRef,
  ComponentType,
  ElementType,
  ReactNode,
  Ref,
} from "react";
import { Button } from "~/common/button";
import { cn } from "~/common/cn";
import { Heading } from "~/common/heading";
import { RichTextParagraph } from "~/common/paragraph";
import type { RichTextObject } from "@lapuertahostels/rich-text";

type OverlayTextBoxShellProps = {
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
};

type OverlayTextBoxContentProps<TCta extends ElementType = ElementType> = {
  children?: ReactNode;
  heading: string | undefined | null;
  text: RichTextObject | undefined | null;
  cta?: {
    as: TCta;
    label: string;
    variant: "primary" | "secondary";
    icon?: ComponentType<{ className?: string }>;
  } & Omit<ComponentPropsWithoutRef<TCta>, "as">;
};

type OverlayTextBoxProps<TCta extends ElementType = ElementType> =
  OverlayTextBoxShellProps & OverlayTextBoxContentProps<TCta>;

export function OverlayTextBox({
  ref,
  position,
  ...content
}: OverlayTextBoxProps) {
  return (
    <OverlayTextBoxShell ref={ref} position={position}>
      <OverlayTextBoxContent {...content} />
    </OverlayTextBoxShell>
  );
}

export function OverlayTextBoxShell({
  ref,
  position,
  children,
}: OverlayTextBoxShellProps) {
  const overlayTextBoxPosition = position || "top-left";

  return (
    <div
      ref={ref}
      className={cn(
        "w-full bg-white px-6 pt-3 pb-6 text-center lg:absolute lg:w-auto lg:max-w-xs lg:rounded-md lg:px-8 lg:pt-5 lg:pb-8 lg:text-left lg:shadow-lg xl:max-w-sm 2xl:max-w-md",
        {
          "lg:top-12 lg:left-12 xl:top-20 xl:left-20":
            overlayTextBoxPosition === "top-left",
          "lg:top-12 lg:right-12 xl:top-20 xl:right-20":
            overlayTextBoxPosition === "top-right",
          "lg:bottom-12 lg:left-12 xl:bottom-20 xl:left-20":
            overlayTextBoxPosition === "bottom-left",
          "lg:right-12 lg:bottom-12 xl:right-20 xl:bottom-20":
            overlayTextBoxPosition === "bottom-right",
        },
      )}
    >
      {children}
    </div>
  );
}

export function OverlayTextBoxContent({
  heading,
  text,
  children,
  cta,
}: OverlayTextBoxContentProps) {
  return (
    <>
      <Heading as="h3" size="small">
        {heading}
      </Heading>
      {text && <RichTextParagraph className="mt-2">{text}</RichTextParagraph>}
      {children}
      {cta && (
        <Button {...cta} className="mt-4">
          {cta.label}
        </Button>
      )}
    </>
  );
}
