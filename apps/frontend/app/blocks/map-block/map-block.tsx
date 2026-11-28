import type { Map as MapType } from "@lapuertahostels/payload-types";
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
} from "@vis.gl/react-google-maps";
import { useMemo, useRef, useState } from "react";
import { useTheme } from "~/themes";
import { cn } from "~/common/cn";
import { useSettings } from "~/common/common";
import { MapViewport } from "./map-viewport";
import { useMapLocations } from "./use-map-locations";
import { MapLocationDetails } from "./map-location-details";

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
  const entries = useMemo(
    () =>
      locations?.length
        ? locations
        : address
          ? [{ address, overlayTextBox }]
          : [],
    [locations, address, overlayTextBox],
  );
  const { addresses, ready, resolved } = useMapLocations(entries);
  const [selection, setSelection] = useState<{
    addresses: string;
    index: number;
  }>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { maps } = useSettings();

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
                  title={entry.label}
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
          <MapLocationDetails
            overlayRef={overlayRef}
            locations={resolved}
            selected={selected}
            onSelect={(index) => setSelection({ addresses, index })}
          />
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
