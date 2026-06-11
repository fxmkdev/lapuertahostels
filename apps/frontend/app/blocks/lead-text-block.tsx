import { RichTextParagraph } from "~/common/paragraph";
import { Button } from "~/common/button";
import { Heading } from "~/common/heading";
import { LeadText } from "@lapuertahostels/payload-types";
import { cn } from "~/common/cn";
import { PageLink } from "~/common/page-link";
import { RichTextObject } from "@lapuertahostels/rich-text";

export type LeadBlockProps = LeadText;

export function LeadTextBlock({
  heading,
  text,
  elementId,
  cta,
}: LeadBlockProps) {
  return (
    <div
      id={elementId || undefined}
      className="mx-auto mt-12 mb-14 flex max-w-4xl flex-col px-8 md:mt-24 md:mb-36 lg:px-0"
    >
      {heading && (
        <Heading as="h3" size="medium">
          {heading}
        </Heading>
      )}

      <RichTextParagraph
        justify
        size="extra-large"
        className={cn(heading && "mt-4 md:mt-6")}
      >
        {text as unknown as RichTextObject | undefined}
      </RichTextParagraph>

      {cta?.show && (
        <Button
          as={PageLink}
          link={cta.link}
          size="large"
          variant={cta.variant || undefined}
          className="mt-10 text-center sm:self-center md:mt-12"
        >
          {cta.label}
        </Button>
      )}
    </div>
  );
}
