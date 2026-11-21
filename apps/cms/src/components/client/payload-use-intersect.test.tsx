import { useIntersect } from "@payloadcms/ui/hooks/useIntersect";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("uses the latest intersection when block expansion batches viewport changes", () => {
  const observers: IntersectionObserverMock[] = [];
  class IntersectionObserverMock {
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(readonly callback: IntersectionObserverCallback) {
      observers.push(this);
    }
  }
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

  const { result } = renderHook(() => useIntersect({ rootMargin: "1000px" }));
  const element = document.createElement("div");
  act(() => result.current[0](element));
  const observer = observers.find(({ observe }) => observe.mock.calls.length);
  expect(observer).toBeDefined();
  const entries = [false, true].map(
    (isIntersecting, time) =>
      ({
        target: element,
        isIntersecting,
        time,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        intersectionRatio: isIntersecting ? 1 : 0,
        rootBounds: null,
      }) satisfies IntersectionObserverEntry,
  );

  act(() => {
    observer!.callback(entries, observer as unknown as IntersectionObserver);
  });

  expect(result.current[1]).toBe(entries[1]);
  expect(result.current[1]?.isIntersecting).toBe(true);
});
