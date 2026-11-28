import type { Page } from "@lapuertahostels/payload-types";
import { OverlayTitle } from "./common/overlay-title";
import { useEnvironment } from "~/common/environment";
import {
  publicMediaUrl,
  readImageManifest,
} from "@lapuertahostels/payload-types";
import { MediaPlaceholder, getSrcFromMedia } from "~/common/media";
import { isObject } from "~/common/utils";

export type HeroVideoBlockProps = NonNullable<Page["hero"]>[number] & {
  blockType: "HeroVideo";
};

export function HeroVideoBlock({
  previewImage,
  video,
  overlayTitle,
}: HeroVideoBlockProps) {
  const { mediaBaseUrl, mediaUseDerivatives } = useEnvironment();

  const previewVariant =
    mediaUseDerivatives !== false && isObject(previewImage)
      ? readImageManifest(previewImage.imageVariants)
          ?.variants.filter((v) => v.preset === "natural")
          .find((v) => v.width >= 1200)
      : undefined;
  const previewUrl =
    previewVariant?.key ?? getSrcFromMedia(previewImage).replace(/^\//, "");
  return (
    <div className="bg-puerta-100 relative h-[30rem] md:h-[40rem]">
      {isObject(video) ? (
        <video
          src={publicMediaUrl(
            mediaBaseUrl,
            getSrcFromMedia(video).replace(/^\//, ""),
            video.updatedAt,
          )}
          poster={
            previewUrl ? publicMediaUrl(mediaBaseUrl, previewUrl) : undefined
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
