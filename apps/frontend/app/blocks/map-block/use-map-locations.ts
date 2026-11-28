import type { Map as MapType } from "@lapuertahostels/payload-types";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";
import type { Place } from "~/common/google-maps";
import { PlaceResolver } from "~/common/google-maps";

type MapLocation = {
  name?: string | null;
  address?: string | null;
  overlayTextBox?: MapType["overlayTextBox"];
};

async function resolvePlaces(
  queries: string[],
  placesLibrary: google.maps.PlacesLibrary,
) {
  const resolver = new PlaceResolver(placesLibrary);
  // Resolve repeated addresses once without merging their individual details.
  const requests = new Map<string, Promise<Place>>();
  return Promise.all(
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
}

export function useMapLocations(entries: MapLocation[]) {
  const placesLibrary = useMapsLibrary("places");
  // Unsaved preview rows can lack an address even though saved rows require it.
  const addresses = JSON.stringify(
    entries.map((entry) =>
      typeof entry.address === "string" ? entry.address.trim() : "",
    ),
  );
  const [result, setResult] = useState<{
    addresses: string;
    places: (Place | undefined)[];
  }>();

  useEffect(() => {
    if (!placesLibrary) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const places = await resolvePlaces(JSON.parse(addresses), placesLibrary);
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
            return place
              ? [
                  {
                    ...entry,
                    address: entry.address ?? "",
                    label:
                      entry.name?.trim() ||
                      entry.overlayTextBox?.heading?.trim() ||
                      entry.address?.trim() ||
                      "",
                    place,
                    index,
                  },
                ]
              : [];
          })
        : [],
    [ready, entries, result],
  );
  return { addresses, ready, resolved };
}

export type ResolvedMapLocation = ReturnType<
  typeof useMapLocations
>["resolved"][number];
