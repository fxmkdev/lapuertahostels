import { cn } from "../../common/cn";
import { useState } from "react";
import type { MediaImageProps } from "~/common/media";
import { MediaImage } from "~/common/media";

export type SlideImageProps = Pick<MediaImageProps, "media"> & {
  withPreview?: boolean;
  alignment?: "center" | "bottom";
  onLoadingFinished?: () => void;
};

export function SlideImage({
  media,
  withPreview = false,
  alignment,
  onLoadingFinished,
}: SlideImageProps) {
  const [state, setState] = useState<"loading" | "loaded">("loading");

  const imageProps = {
    media,
    layout: "responsive",
    srcMultiplier: 6,
    sizes: "100vw",
    className: cn("absolute top-0 h-full w-full object-cover", {
      "object-[center_90%]": alignment === "bottom",
    }),
    transformation: {
      aspectRatio: { width: 4, height: 3 },
      width: 800,
    },
  } as MediaImageProps;

  return (
    <div className={"h-full w-full"}>
      {withPreview && state === "loading" && (
        <MediaImage
          {...imageProps}
          transformation={{ ...imageProps.transformation, blur: 20 }}
        />
      )}
      <MediaImage
        {...imageProps}
        onLoadingFinished={() => {
          setState("loaded");
          onLoadingFinished?.();
        }}
        loading={withPreview ? "eager" : "lazy"}
        data-testid="full-image"
      />
    </div>
  );
}
