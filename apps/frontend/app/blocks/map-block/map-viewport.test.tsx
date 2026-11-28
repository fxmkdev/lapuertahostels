import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MapViewport } from "./map-viewport";

const { map } = vi.hoisted(() => ({
  map: { moveCamera: vi.fn(), fitBounds: vi.fn() },
}));
vi.mock("@vis.gl/react-google-maps", () => ({ useMap: () => map }));
let resize: ResizeObserverCallback;
const disconnect = vi.fn();
const points = [
  { lat: 11, lng: -74 },
  { lat: 12, lng: -73 },
];
class Bounds {
  points: google.maps.LatLngLiteral[] = [];
  extend(point: google.maps.LatLngLiteral) {
    this.points.push(point);
  }
}

beforeEach(() => {
  vi.stubGlobal("google", { maps: { LatLngBounds: Bounds } });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const container = document.createElement("div");
  const overlay = document.createElement("div");
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 1200,
  } as DOMRect);
  vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
    left: 48,
    right: 400,
  } as DOMRect);
  return {
    container,
    overlay,
    props: {
      points,
      zoomLevel: 14.5,
      mapContainerRef: { current: container },
      overlayRef: { current: overlay },
    },
  };
}

test("one place preserves the configured center and zoom", () => {
  const { props } = fixture();
  render(<MapViewport {...props} points={[points[0]]} />);
  expect(map.moveCamera).toHaveBeenLastCalledWith({
    center: points[0],
    zoom: 14.5,
  });
  expect(map.fitBounds).not.toHaveBeenCalled();
});

test("fits every location with edge padding on mobile and refits on resize", () => {
  const { props } = fixture();
  const { unmount } = render(<MapViewport {...props} />);
  expect(map.fitBounds).toHaveBeenLastCalledWith(
    expect.objectContaining({ points }),
    { top: 64, bottom: 64, left: 64, right: 64 },
  );
  act(() => resize([], {} as ResizeObserver));
  expect(map.fitBounds).toHaveBeenCalledTimes(2);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

test("reserves the actual desktop overlay width on either side", () => {
  const { props, overlay } = fixture();
  overlay.style.position = "absolute";
  const { rerender } = render(<MapViewport {...props} />);
  expect(map.fitBounds).toHaveBeenLastCalledWith(expect.any(Bounds), {
    top: 64,
    bottom: 64,
    left: 432,
    right: 64,
  });
  vi.mocked(overlay.getBoundingClientRect).mockReturnValue({
    left: 800,
    right: 1152,
  } as DOMRect);
  rerender(<MapViewport {...props} overlayPosition="bottom-right" />);
  expect(map.fitBounds).toHaveBeenLastCalledWith(expect.any(Bounds), {
    top: 64,
    bottom: 64,
    left: 64,
    right: 432,
  });
});

test("coincident coordinates still use fitted bounds and resizing reflects new geometry", () => {
  const { props, overlay } = fixture();
  overlay.style.position = "absolute";
  render(<MapViewport {...props} points={[points[0], points[0]]} />);
  expect(map.fitBounds).toHaveBeenLastCalledWith(
    expect.objectContaining({ points: [points[0], points[0]] }),
    expect.anything(),
  );
  vi.mocked(overlay.getBoundingClientRect).mockReturnValue({
    left: 48,
    right: 500,
  } as DOMRect);
  act(() => resize([], {} as ResizeObserver));
  expect(map.fitBounds).toHaveBeenLastCalledWith(
    expect.any(Bounds),
    expect.objectContaining({ left: 532 }),
  );
});
