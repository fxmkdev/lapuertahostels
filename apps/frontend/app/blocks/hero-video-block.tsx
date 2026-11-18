import type { Page } from "@lapuertahostels/payload-types";
import { OverlayTitle } from "./common/overlay-title";
import { useEnvironment } from "~/common/environment";
import { MediaPlaceholder } from "~/common/media";
import { gracefully, isObject } from "~/common/utils";

export type HeroVideoBlockProps = NonNullable<Page["hero"]>[number] & {
  blockType: "HeroVideo";
};

export function HeroVideoBlock({
  previewImage,
  video,
  overlayTitle,
}: HeroVideoBlockProps) {
  const { imagekitBaseUrl } = useEnvironment();

  const previewUrl = gracefully(previewImage, "filename");
  return (
    <div className="bg-puerta-100 relative h-[30rem] md:h-[40rem]">
      {isObject(video) ? (
        <video
          src={`${imagekitBaseUrl}/${video.filename}`}
          poster={
            previewUrl ? `${imagekitBaseUrl}/tr:h-720/${previewUrl}` : undefined
          }
          autoPlay
          muted
          loop
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          className="pointer-events-none absolute top-0 h-full w-full object-cover"
        >
          {video.alt && <p>{video.alt}</p>}
        </video>
      ) : (
        <MediaPlaceholder />
      )}
      {overlayTitle?.show && (
        <OverlayTitle headingLevel={2} {...overlayTitle} />
      )}
    </div>
  );
}
