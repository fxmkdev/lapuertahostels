import { Map as MapType } from "@lapuertahostels/payload-types";
import {
  AdvancedMarker,
  Map,
  Pin,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { useTheme } from "~/themes";
import { cn } from "~/common/cn";
import { Link } from "~/common/link";
import { MapPinIcon } from "@heroicons/react/20/solid";
import { Place, PlaceResolver } from "~/common/google-maps";
import { OverlayTextBox } from "../common/overlay-text-box";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { useSettings } from "~/common/common";

type MapBlockType = MapType;

export type MapBlockProps = MapBlockType;

export function MapBlock({
  elementId,
  address,
  zoomLevel,
  overlayTextBox,
}: MapBlockProps) {
  const placesLibrary = useMapsLibrary("places");
  const [place, setPlace] = useState<Place>();
  const [isLoading, setIsLoading] = useState(false);
  const [requestedAddress, setRequestedAddress] = useState<string>();

  const { maps } = useSettings();

  useEffect(() => {
    if (
      !placesLibrary ||
      !address ||
      address.length < 3 ||
      isLoading ||
      requestedAddress === address
    ) {
      return;
    }

    const debounceTimeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setRequestedAddress(address);
      try {
        setPlace(await new PlaceResolver(placesLibrary).resolvePlace(address));
      } finally {
        setIsLoading(false);
      }
    }, 1_000);

    return () => {
      if (debounceTimeoutId != null) {
        window.clearTimeout(debounceTimeoutId);
      }
    };
  }, [placesLibrary, isLoading, place, address, requestedAddress]);

  return (
    <div
      id={elementId || undefined}
      className={cn(
        "my-44 overflow-hidden",
        !place && "animate-pulse bg-neutral-100",
      )}
    >
      <div
        className={cn(
          "flex flex-col-reverse gap-4 transition duration-1000 ease-in-out lg:relative lg:h-[35rem]",
          place ? "scale-100 opacity-100" : "scale-105 opacity-0",
        )}
      >
        <div className={cn("h-[35rem] lg:h-full")}>
          {place && (
            <Map
              disableDefaultUI={true}
              keyboardShortcuts={false}
              gestureHandling="none"
              clickableIcons={false}
              mapId={maps?.mapId}
              colorScheme="LIGHT"
              zoom={zoomLevel}
              center={place.location}
              controlled={true}
            >
              <LocationMarker location={place.location} />
            </Map>
          )}
        </div>

        {overlayTextBox && place && (
          <OverlayTextBox
            position={overlayTextBox.position}
            heading={overlayTextBox.heading}
            text={overlayTextBox.text as unknown as RichTextObject}
            cta={
              overlayTextBox.callToActionLabel
                ? {
                    icon: MapPinIcon,
                    label: overlayTextBox.callToActionLabel,
                    as: Link,
                    variant: "secondary",
                    to: place.url,
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function LocationMarker({ location }: { location: google.maps.LatLngLiteral }) {
  const theme = useTheme();
  return (
    <AdvancedMarker position={location}>
      <Pin
        background={theme.mapPinCssColors.background}
        glyphColor={theme.mapPinCssColors.glyph}
        borderColor={theme.mapPinCssColors.border}
      />
    </AdvancedMarker>
  );
}
