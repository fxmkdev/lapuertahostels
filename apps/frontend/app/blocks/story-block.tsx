import { Heading } from "../common/heading";
import { cn } from "../common/cn";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { LongFormRichText } from "~/common/long-form-rich-text";
import { MediaImage } from "~/common/media";
import { Story } from "@lapuertahostels/payload-types";

export type StoryBlockProps = Story;

export function StoryBlock({
  heading,
  image,
  imagePosition,
  grayscaleImage,
  text,
  elementId,
}: StoryBlockProps) {
  imagePosition = image ? (imagePosition ?? "left") : undefined;
  return (
    <div
      id={elementId || undefined}
      className={cn(
        image &&
          "lg:grid lg:grid-cols-2 lg:items-center lg:justify-center lg:gap-16",
        "mx-auto mt-20 mb-24 max-w-4xl",
      )}
    >
      <div
        className={cn("px-8 lg:px-0", {
          "lg:order-last": imagePosition === "left",
          "lg:order-first": imagePosition === "right",
        })}
      >
        {heading && (
          <Heading as="h3" size="medium">
            {heading}
          </Heading>
        )}
        <div className={cn(heading && "mt-4 md:mt-6")}>
          <LongFormRichText
            content={text as unknown as RichTextObject | undefined}
            baseHeadingLevel={heading ? 4 : 3}
          />
        </div>
      </div>
      {image && (
        <div
          className={cn(
            "mt-32 aspect-3/4 overflow-hidden sm:mx-auto sm:max-w-xs sm:rounded-md sm:shadow-lg lg:mt-0 lg:max-w-none",
            {
              "sm:-rotate-6 lg:mr-12 lg:-ml-10": imagePosition === "left",
              "sm:rotate-6 lg:-mr-10 lg:ml-12": imagePosition === "right",
            },
          )}
        >
          <MediaImage
            media={image}
            className="h-full w-full object-cover"
            transformation={{
              aspectRatio: { width: 3, height: 4 },
              width: 400,
              enhancement: grayscaleImage ? "grayscale" : undefined,
            }}
            layout="responsive"
            srcMultiplier={5}
            sizes="(min-width: 640px) 320px, (min-width: 896px) 448px, 100vw"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
