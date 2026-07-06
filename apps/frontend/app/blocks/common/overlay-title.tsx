import { RichTextHeading, RichTextHeadingProps } from "~/common/heading";
import { Button } from "../../common/button";
import { cn } from "../../common/cn";
import { MouseEventHandler } from "react";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { PageLink } from "~/common/page-link";
import { RichTextParagraph } from "~/common/paragraph";
import { Page } from "@lapuertahostels/payload-types";

type OverlayTitleType = NonNullable<
  (NonNullable<Page["hero"]>[number] & {
    blockType: "HeroVideo";
  })["overlayTitle"]
>;

export type OverlayTitleProps = Pick<
  OverlayTitleType,
  "text" | "supportingText" | "cta" | "position" | "overlay"
> & {
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  headingLevel: number;
};

export function OverlayTitle({
  headingLevel,
  text,
  supportingText,
  position = "center",
  cta,
  overlay = "moderate",
  onMouseEnter,
  onMouseLeave,
}: OverlayTitleProps) {
  return (
    <>
      <div
        className={cn("absolute top-0 h-full w-full bg-black", {
          "opacity-15": overlay === "subtle",
          "opacity-20": overlay === "moderate",
          "opacity-25": overlay === "intense",
        })}
      />
      <div
        className={cn("absolute max-w-xl", {
          "top-8 left-8": position === "top-left",
          "top-8 right-8 text-right": position === "top-right",
          "bottom-8 left-8": position === "bottom-left",
          "right-8 bottom-8 text-right": position === "bottom-right",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center":
            position === "center",
        })}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <RichTextHeading
          as={`h${headingLevel}` as RichTextHeadingProps["as"]}
          size="extra-large"
          variant="white"
          textShadow
        >
          {text as RichTextObject | undefined}
        </RichTextHeading>
        {supportingText && (
          <RichTextParagraph
            size="extra-large"
            variant="white"
            textShadow
            className="mt-6"
          >
            {supportingText as unknown as RichTextObject}
          </RichTextParagraph>
        )}
        {cta?.show && (
          <Button
            as={PageLink}
            link={cta.link}
            size="large"
            variant={cta.variant || "primary"}
            blackShadow
            className={cn(supportingText ? "mt-10" : "mt-6")}
          >
            {cta.label}
          </Button>
        )}
      </div>
    </>
  );
}
