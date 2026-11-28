import { readImageManifest } from "@lapuertahostels/payload-types";
import { Button } from "~/common/button";
import { Heading } from "~/common/heading";
import { ImageViewer } from "~/common/image-viewer/image-viewer";
import type { Room } from "./types";
import { RichTextParagraph } from "~/common/paragraph";
import type { RichTextObject } from "@lapuertahostels/rich-text";
import {
  getAltFromMedia,
  getSrcFromMedia,
  getFocalPropsFromMedia,
  getDisplayDimensionsFromMedia,
} from "~/common/media";
import { PageLink } from "~/common/page-link";

export type RoomCardProps = Partial<Room>;

export function RoomCard({ heading, text, images, cta }: RoomCardProps) {
  return (
    <div className="flex max-w-[35rem] flex-col items-center gap-8">
      <Heading as="h3" size="medium" className="px-6 text-center sm:px-0">
        {heading}
      </Heading>
      <ImageViewer
        images={images?.map((image) => {
          const dimensions = getDisplayDimensionsFromMedia(image.image);
          return {
            src: getSrcFromMedia(image.image),
            originalVersion:
              typeof image.image === "object"
                ? image.image.updatedAt
                : undefined,
            variants:
              typeof image.image === "object"
                ? readImageManifest(image.image.imageVariants)
                : undefined,
            alt: getAltFromMedia(image.image),
            caption: image.caption ?? "",
            focalPoint: getFocalPropsFromMedia(image.image).focalPoint,
            aspectRatio: dimensions ? dimensions.width / dimensions.height : 1,
          };
        })}
      />
      {text && (
        <RichTextParagraph justify={true} className="px-6 sm:px-0">
          {text as unknown as RichTextObject | undefined}
        </RichTextParagraph>
      )}
      {cta && cta.show !== false && (
        <Button
          as={PageLink}
          link={cta.link}
          variant={cta.variant || undefined}
        >
          {cta.label}
        </Button>
      )}
    </div>
  );
}
