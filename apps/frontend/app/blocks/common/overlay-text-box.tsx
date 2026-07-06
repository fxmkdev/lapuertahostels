import { ComponentPropsWithoutRef, ComponentType, ElementType } from "react";
import { Button } from "~/common/button";
import { cn } from "~/common/cn";
import { Heading } from "~/common/heading";
import { RichTextParagraph } from "~/common/paragraph";
import { RichTextObject } from "@lapuertahostels/rich-text";

type OverlayTextBoxProps<TCta extends ElementType = ElementType> = {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
  heading: string | undefined | null;
  text: RichTextObject | undefined | null;
  cta?: {
    as: TCta;
    label: string;
    variant: "primary" | "secondary";
    icon?: ComponentType<{ className?: string }>;
  } & Omit<ComponentPropsWithoutRef<TCta>, "as">;
};

export function OverlayTextBox({
  position,
  cta,
  heading,
  text,
}: OverlayTextBoxProps) {
  const overlayTextBoxPosition = position || "top-left";

  return (
    <div
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
      <Heading as="h3" size="small">
        {heading}
      </Heading>
      {text && <RichTextParagraph className="mt-2">{text}</RichTextParagraph>}
      {cta && (
        <Button {...cta} className="mt-4">
          {cta.label}
        </Button>
      )}
    </div>
  );
}
