import { useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { RefObject } from "react";

type MapViewportProps = {
  points: google.maps.LatLngLiteral[];
  zoomLevel: number;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  overlayPosition?: string | null;
};

export function MapViewport({
  points,
  zoomLevel,
  mapContainerRef,
  overlayRef,
  overlayPosition,
}: MapViewportProps) {
  const map = useMap();
  useEffect(() => {
    const container = mapContainerRef.current;
    const overlay = overlayRef.current;
    if (!map || !container || !points.length) return;

    const fit = () => {
      if (points.length === 1) {
        map.moveCamera({ center: points[0], zoom: zoomLevel });
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      const padding = { top: 64, bottom: 64, left: 64, right: 64 };
      if (overlay && getComputedStyle(overlay).position === "absolute") {
        const mapRect = container.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        if (overlayPosition?.endsWith("right")) {
          padding.right = Math.max(64, mapRect.right - overlayRect.left + 32);
        } else {
          padding.left = Math.max(64, overlayRect.right - mapRect.left + 32);
        }
      }
      map.fitBounds(bounds, padding);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    if (overlay) observer.observe(overlay);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [map, points, zoomLevel, mapContainerRef, overlayRef, overlayPosition]);
  return null;
}
