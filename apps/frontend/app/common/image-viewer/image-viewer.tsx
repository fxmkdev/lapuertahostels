import { Image } from "../image";
import type { ImageViewerImage } from "./types";
import { useState } from "react";
import { ImageViewerDialog } from "./image-viewer-dialog";
import { Heading } from "../heading";
import { useTranslation } from "react-i18next";
import { MediaPlaceholder } from "../media";

export type ImageViewerProps = {
  className?: string;
  images?: ImageViewerImage[];
};

export function ImageViewer({ images, className }: ImageViewerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState<
    number | undefined
  >(undefined);
  const [t] = useTranslation();
  return (
    <div className={className}>
      <div className="grid max-w-[35rem] grid-cols-4 grid-rows-[auto_auto] gap-1.5 overflow-hidden sm:gap-2 sm:rounded-md">
        <button
          className="group col-span-4 aspect-16/9 overflow-hidden bg-white shadow-md"
          onClick={() => {
            setCurrentImageIndex(0);
          }}
        >
          {images && images.length >= 1 && images[0].src ? (
            <Image
              src={images[0].src}
              variants={images[0].variants}
              originalVersion={images[0].originalVersion}
              alt={images[0].alt}
              focalPoint={images[0].focalPoint}
              className="h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:opacity-75"
              transformation={{
                width: 560,
                aspectRatio: { width: 16, height: 9 },
              }}
              loading="lazy"
              layout="fixed"
            />
          ) : (
            <MediaPlaceholder />
          )}
        </button>
        {images?.slice(1, 5).map((image, index) => (
          <button
            className="group relative block w-full overflow-hidden bg-white shadow-md"
            key={image.src}
            onClick={() => {
              setCurrentImageIndex(index + 1);
            }}
          >
            <Image
              src={image.src}
              variants={image.variants}
              originalVersion={image.originalVersion}
              alt={image.alt}
              focalPoint={image.focalPoint}
              className="aspect-4/3 object-cover transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:opacity-75"
              transformation={{
                width: 140,
                aspectRatio: { width: 4, height: 3 },
              }}
              loading="lazy"
              layout="fixed"
            />
            {images.length > 5 && index === 3 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-6">
                <Heading as="h4" size="extra-small" variant="white">
                  {t("imageViewer.seeMoreImages", {
                    count: images.length - 4,
                  })}
                </Heading>
              </div>
            )}
          </button>
        ))}
      </div>
      {images?.map((_, i) => (
        <ImageViewerDialog
          key={i}
          images={images}
          isOpen={currentImageIndex === i}
          onDismiss={() => setCurrentImageIndex(undefined)}
          defaultImageIndex={currentImageIndex}
        />
      ))}
    </div>
  );
}
