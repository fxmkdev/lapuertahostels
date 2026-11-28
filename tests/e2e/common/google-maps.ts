import type { Page } from "@playwright/test";

/** Install the Maps surface used by the block, without network or API keys. */
export async function mockGoogleMaps(page: Page) {
  await page.addInitScript(() => {
    type Point = { lat: number; lng: number };
    class Bounds {
      points: Point[] = [];
      extend(point: Point) {
        this.points.push(point);
        return this;
      }
      toJSON() {
        return { north: 12, south: 11, east: -73, west: -74 };
      }
    }
    class MapView extends EventTarget {
      constructor(
        public element: HTMLElement,
        public options: { center: Point; zoom: number },
      ) {
        super();
        element.dataset.testid = "google-map";
        element.style.cssText =
          "height:100%;background:#eee;display:flex;align-items:center;justify-content:center;gap:40px";
      }
      setOptions(options: object) {
        Object.assign(this.options, options);
      }
      moveCamera(options: object) {
        this.setOptions(options);
      }
      fitBounds(bounds: Bounds, padding: object) {
        this.element.dataset.bounds = JSON.stringify(bounds.points);
        this.element.dataset.padding = JSON.stringify(padding);
      }
      getCenter() {
        return { toJSON: () => this.options.center };
      }
      getZoom() {
        return this.options.zoom;
      }
      getHeading() {
        return 0;
      }
      getTilt() {
        return 0;
      }
      getBounds() {
        return new Bounds();
      }
      getDiv() {
        return this.element;
      }
    }
    class Marker extends EventTarget {
      element = document.createElement("button");
      private contentElement: HTMLElement | undefined;
      constructor() {
        super();
        this.element.type = "button";
        this.element.addEventListener("click", () =>
          this.dispatchEvent(new Event("click")),
        );
      }
      set map(map: MapView | null) {
        if (map) map.element.append(this.element);
        else this.element.remove();
      }
      set title(title: string) {
        this.element.setAttribute("aria-label", `Pin ${title}`);
      }
      get content() {
        return this.contentElement;
      }
      set content(content: HTMLElement | undefined) {
        this.contentElement = content;
        if (content) this.element.replaceChildren(content);
      }
    }
    class Pin {
      element = document.createElement("span");
      constructor() {
        this.element.textContent = "●";
      }
    }
    class PlacesService {
      findPlaceFromQuery(
        { query }: { query: string },
        callback: (results: object[]) => void,
      ) {
        const lat = query.includes("Aqua") ? 11.24 : 11.25;
        callback([
          {
            place_id: query,
            geometry: { location: { lat: () => lat, lng: () => -74.2 } },
          },
        ]);
      }
      getDetails(
        { placeId }: { placeId: string },
        callback: (result: object) => void,
      ) {
        callback({
          url: `https://maps.example.com/${encodeURIComponent(placeId)}`,
        });
      }
    }
    const marker = { AdvancedMarkerElement: Marker, PinElement: Pin };
    const places = { PlacesService };
    const settings = {};
    const maps = {
      version: "3.61.0",
      Map: MapView,
      LatLngBounds: Bounds,
      marker,
      places,
      Settings: { getInstance: () => settings },
      event: {
        addListener(target: EventTarget, name: string, handler: EventListener) {
          target.addEventListener(name, handler);
          return { remove: () => target.removeEventListener(name, handler) };
        },
        clearInstanceListeners() {},
      },
      async importLibrary(name: string): Promise<object> {
        return name === "marker" ? marker : name === "places" ? places : maps;
      },
    };
    Object.defineProperty(window, "google", {
      value: { maps },
      configurable: true,
    });
  });
}
