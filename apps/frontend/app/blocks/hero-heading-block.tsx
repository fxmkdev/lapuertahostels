import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { SlideImage } from "./slides-block/slide-image";
import { OverlayTitle, OverlayTitleProps } from "./common/overlay-title";
import { Heading } from "~/common/heading";
import { Page } from "@lapuertahostels/payload-types";

type HeroHeadingBlockProps = Partial<
  NonNullable<Page["hero"]>[number] & {
    blockType: "HeroHeading";
  }
>;

export function HeroHeadingBlock({ heading, image }: HeroHeadingBlockProps) {
  return image ? (
    <div className="relative min-h-72 shadow-md md:min-h-96">
      <SlideImage media={image} withPreview={true} alignment="center" />
      <OverlayTitle
        headingLevel={2}
        position="center"
        text={
          heading
            ? (richTextRoot(
                paragraph(text(heading)),
              ) as unknown as OverlayTitleProps["text"])
            : undefined
        }
        overlay="intense"
      />
    </div>
  ) : (
    <div className="flex min-h-28 items-end justify-center px-8 py-4 text-neutral-700 md:min-h-40 md:py-8">
      <Heading
        size="medium"
        as="h2"
        variant="inherit"
        className="border-b-2 border-neutral-300 pb-2 text-center"
      >
        {heading}
      </Heading>
    </div>
  );
}
