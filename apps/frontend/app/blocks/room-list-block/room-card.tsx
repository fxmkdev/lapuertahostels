import { Button } from "~/common/button";
import { Heading } from "~/common/heading";
import { ImageViewer } from "~/common/image-viewer/image-viewer";
import { Room } from "./types";
import { RichTextParagraph } from "~/common/paragraph";
import { RichTextObject } from "@fxmk/common";
import { getAltFromMedia, getSrcFromMedia } from "~/common/media";
import { PageLink } from "~/common/page-link";
import { isObject } from "~/common/utils";

export type RoomCardProps = Partial<Room>;

export function RoomCard({ heading, text, images, cta }: RoomCardProps) {
  return (
    <div className="flex max-w-[35rem] flex-col items-center gap-8">
      <Heading as="h3" size="medium" className="px-6 text-center sm:px-0">
        {heading}
      </Heading>
      <ImageViewer
        images={images?.map((image) => {
          return {
            src: getSrcFromMedia(image.image),
            alt: getAltFromMedia(image.image),
            caption: image.caption ?? "",
            aspectRatio:
              isObject(image.image) && image.image.width && image.image.height
                ? image.image.width / image.image.height
                : 1,
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
