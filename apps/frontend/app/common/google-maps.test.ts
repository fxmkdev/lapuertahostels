import { expect, test } from "vitest";
import { PlaceResolver } from "./google-maps";

test.each([null, []])(
  "rejects an empty Places response instead of throwing in its callback: %s",
  async (results) => {
    const library = {
      PlacesService: class {
        findPlaceFromQuery(_: unknown, callback: (results: unknown) => void) {
          callback(results);
        }
      },
    } as unknown as google.maps.PlacesLibrary;
    await expect(
      new PlaceResolver(library).resolvePlace("Missing address"),
    ).rejects.toThrow("No results found");
  },
);
