import type { Map as MapType } from "@lapuertahostels/payload-types";
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "~/themes";
import { cn } from "~/common/cn";
import { Link } from "~/common/link";
import { MapPinIcon } from "@heroicons/react/20/solid";
import type { Place } from "~/common/google-maps";
import { PlaceResolver } from "~/common/google-maps";
import { OverlayTextBox } from "../common/overlay-text-box";
import type { RichTextObject } from "@lapuertahostels/rich-text";
import { useSettings } from "~/common/common";
import { MapViewport } from "./map-viewport";

// Cached pages and old CMS responses can still use the single-location shape.
export type MapBlockProps = Omit<MapType, "locations"> & {
  locations?: MapType["locations"] | null;
};

export function MapBlock({
  elementId,
  address,
  locations,
  zoomLevel,
  overlayTextBox,
}: MapBlockProps) {
  const placesLibrary = useMapsLibrary("places");
  const entries = useMemo(
    () =>
      locations?.length
        ? locations
        : address
          ? [{ address, overlayTextBox }]
          : [],
    [locations, address, overlayTextBox],
  );
  const addresses = JSON.stringify(
    entries.map((entry) => entry.address.trim()),
  );
  const [result, setResult] = useState<{
    addresses: string;
    places: (Place | undefined)[];
  }>();
  const [selection, setSelection] = useState<{
    addresses: string;
    index: number;
  }>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { maps } = useSettings();

  useEffect(() => {
    if (!placesLibrary) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const resolver = new PlaceResolver(placesLibrary);
      const queries: string[] = JSON.parse(addresses);
      // Resolve repeated addresses once without merging their individual details.
      const requests = new Map<string, Promise<Place>>();
      const places = await Promise.all(
        queries.map(async (query) => {
          if (query.length < 3) return undefined;
          try {
            let request = requests.get(query);
            if (!request) {
              request = resolver.resolvePlace(query);
              requests.set(query, request);
            }
            return await request;
          } catch {
            return undefined;
          }
        }),
      );
      if (!cancelled) setResult({ addresses, places });
    }, 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [placesLibrary, addresses]);

  const ready = result?.addresses === addresses;
  const resolved = useMemo(
    () =>
      ready
        ? entries.flatMap((entry, index) => {
            const place = result.places[index];
            return place ? [{ ...entry, place, index }] : [];
          })
        : [],
    [ready, entries, result],
  );
  const selected =
    resolved.find(
      (entry) =>
        selection?.addresses === addresses && entry.index === selection.index,
    ) ?? resolved[0];
  const points = useMemo(
    () => resolved.map(({ place }) => place.location),
    [resolved],
  );
  const details = selected?.overlayTextBox;

  if (ready && !selected) return null;

  return (
    <div
      id={elementId || undefined}
      className={cn(
        "my-44 overflow-hidden",
        !selected && "animate-pulse bg-neutral-100",
      )}
    >
      <div
        className={cn(
          "flex flex-col-reverse gap-4 transition duration-1000 ease-in-out lg:relative lg:h-[35rem]",
          selected ? "scale-100 opacity-100" : "scale-105 opacity-0",
        )}
      >
        <div ref={mapContainerRef} className="h-[35rem] lg:h-full">
          {selected && (
            <GoogleMap
              disableDefaultUI
              keyboardShortcuts={false}
              gestureHandling="none"
              clickableIcons={false}
              mapId={maps?.mapId}
              colorScheme="LIGHT"
              defaultZoom={zoomLevel}
              defaultCenter={selected.place.location}
              maxZoom={zoomLevel}
            >
              <MapViewport
                points={points}
                zoomLevel={zoomLevel}
                mapContainerRef={mapContainerRef}
                overlayRef={overlayRef}
                overlayPosition={details?.position}
              />
              {resolved.map((entry) => (
                <LocationMarker
                  key={entry.index}
                  location={entry.place.location}
                  title={entry.overlayTextBox?.heading || entry.address}
                  selected={entry.index === selected.index}
                  onClick={() =>
                    setSelection({ addresses, index: entry.index })
                  }
                />
              ))}
            </GoogleMap>
          )}
        </div>

        {selected && (
          <OverlayTextBox
            ref={overlayRef}
            position={details?.position}
            heading={details?.heading}
            text={details?.text as RichTextObject | undefined}
            cta={
              details?.callToActionLabel
                ? {
                    icon: MapPinIcon,
                    label: details.callToActionLabel,
                    as: Link,
                    variant: "secondary",
                    to: selected.place.url,
                  }
                : undefined
            }
          >
            {resolved.length > 1 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
                {resolved.map((entry) => (
                  <button
                    key={entry.index}
                    type="button"
                    aria-pressed={entry.index === selected.index}
                    className="rounded border border-current px-3 py-2 text-sm aria-pressed:bg-neutral-100"
                    onClick={() =>
                      setSelection({ addresses, index: entry.index })
                    }
                  >
                    {entry.overlayTextBox?.heading || entry.address}
                  </button>
                ))}
              </div>
            )}
          </OverlayTextBox>
        )}
      </div>
    </div>
  );
}

function LocationMarker({
  location,
  title,
  selected,
  onClick,
}: {
  location: google.maps.LatLngLiteral;
  title: string;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  return (
    <AdvancedMarker
      position={location}
      title={title}
      onClick={onClick}
      zIndex={selected ? 1 : 0}
    >
      <Pin
        background={theme.mapPinCssColors.background}
        glyphColor={theme.mapPinCssColors.glyph}
        borderColor={theme.mapPinCssColors.border}
        scale={selected ? 1.15 : 1}
      />
    </AdvancedMarker>
  );
}
