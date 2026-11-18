import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../common/cn";
import { SlideImage } from "./slide-image";
import { Transition } from "@headlessui/react";
import { OverlayTitle } from "../common/overlay-title";
import { useEnvironment } from "~/common/environment";
import { useSwipeable } from "react-swipeable";
import type { Page } from "@lapuertahostels/payload-types";
import { useTranslation } from "react-i18next";

export type HeroSlidesBlockProps = Partial<
  NonNullable<Page["hero"]>[number] & {
    blockType: "HeroSlides";
  }
>;

export function HeroSlidesBlock({
  seoPageHeading,
  slides,
  autoplayIntervalInSeconds,
}: HeroSlidesBlockProps) {
  autoplayIntervalInSeconds = autoplayIntervalInSeconds || 7;

  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  const {
    slideIndex,
    goTo,
    goToNext,
    goToPrevious,
    startInterval,
    stopInterval,
  } = useSlidesState(slides, autoplayIntervalInSeconds, isReady);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: goToNext,
    onSwipedRight: goToPrevious,
    preventScrollOnSwipe: true,
  });

  const pauseIntervalHandlers = {
    onMouseEnter: () => stopInterval(),
    onMouseLeave: () => startInterval(),
  };

  return (
    <div
      {...swipeHandlers}
      className="bg-puerta-100 relative h-[30rem] focus:outline-hidden md:h-[40rem]"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") goToPrevious();
        if (e.key === "ArrowRight") goToNext();
      }}
      tabIndex={0}
      role="tablist"
    >
      {seoPageHeading && <h2 className="sr-only">{seoPageHeading}</h2>}
      {slides && slides.length > 1 && (
        <>
          <div
            className="absolute bottom-10 hidden w-full justify-center md:flex"
            {...pauseIntervalHandlers}
          >
            {slides.map((_, i) => (
              <button
                className="group z-10 inline-flex h-10 items-center px-2"
                key={i}
                onClick={() => goTo(i)}
              >
                <span
                  className={cn(
                    "h-1 w-10 rounded-full shadow-md shadow-black/50 transition-[background-color,opacity] duration-200 ease-in",
                    i === slideIndex
                      ? "bg-white opacity-100"
                      : "bg-neutral-200 opacity-75 group-hover:bg-white group-hover:opacity-100",
                  )}
                ></span>
                <span className="sr-only">
                  {t("slidesBlock.goToSlide", { slide: i + 1 })}
                </span>
              </button>
            ))}
          </div>
          <div
            className="absolute bottom-0 flex w-full justify-center md:hidden"
            {...pauseIntervalHandlers}
          >
            {slides.map((_, i) => (
              <button
                className="group z-10 inline-flex h-10 grow items-end"
                key={i}
                onClick={() => goTo(i)}
              >
                <span
                  className={cn(
                    "h-1.5 grow transition-[background-color,opacity] duration-200 ease-in",
                    i === slideIndex
                      ? "bg-white opacity-85"
                      : "bg-neutral-200 opacity-65 group-hover:bg-white group-hover:opacity-85",
                  )}
                ></span>
                <span className="sr-only">
                  {t("slidesBlock.goToSlide", { slide: i + 1 })}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {slides?.map((slide, i) => {
        return (
          <Transition
            key={i}
            as="div"
            className="absolute top-0 h-full w-full transform-gpu"
            show={i === slideIndex}
            unmount={false}
            enter="transition-opacity duration-1000"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-1000"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <SlideImage
              media={slide.image}
              withPreview={i === 0}
              alignment={slide.imageAlignment ?? "center"}
              onLoadingFinished={i === 0 ? () => setIsReady(true) : undefined}
            />
            {slide.overlayTitle?.show && (
              <OverlayTitle
                headingLevel={3}
                {...slide.overlayTitle}
                {...pauseIntervalHandlers}
              />
            )}
          </Transition>
        );
      })}
    </div>
  );
}

function useSlidesState(
  slides: HeroSlidesBlockProps["slides"],
  autoplayIntervalInSeconds: number,
  isReady: boolean,
) {
  const [slideIndex, setSlideIndex] = useState(0);
  const { preview } = useEnvironment();

  const intervalRef = useRef(0);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;

    // Do not auto-advance slides in preview mode
    if (preview) return;

    // Do not auto-advance if there is only one slide
    if (!slides || slides.length === 1) return;

    intervalRef.current = window.setInterval(
      () => setSlideIndex((currentIndex) => (currentIndex + 1) % slides.length),
      autoplayIntervalInSeconds * 1000,
    );
  }, [slides, autoplayIntervalInSeconds, preview]);

  function stopInterval() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }
  }

  function goTo(newSlideIndex: number) {
    stopInterval();

    setSlideIndex(newSlideIndex);
  }

  useEffect(() => {
    if (isReady) startInterval();
    return stopInterval;
  }, [startInterval, isReady]);

  return {
    slideIndex,
    stopInterval,
    startInterval,
    goTo,
    goToNext() {
      if (!slides) return;
      goTo((slideIndex + 1) % slides.length);
    },
    goToPrevious() {
      if (!slides) return;
      goTo((slideIndex - 1 + slides.length) % slides.length);
    },
  };
}
