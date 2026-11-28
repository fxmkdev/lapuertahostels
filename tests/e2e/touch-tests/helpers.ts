import { expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

export async function story(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await expect(page.locator("#storybook-root")).not.toBeEmpty();
}

export async function capture(
  page: Page,
  info: TestInfo,
  name: string,
  fullPage = false,
) {
  const path = info.outputPath(name);
  await page.screenshot({ path, fullPage, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

export async function swipeLeft(
  page: Page,
  start: { x: number; y: number },
  distance: number,
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    // Move the finger over rendered frames so Chromium performs native scrolling.
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x - (distance * step) / 6, y: start.y }],
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

export async function targets(locator: Locator, info: TestInfo, name: string) {
  const visible = locator.filter({ visible: true });
  await expect(visible.first()).toBeVisible();
  // Wait for entry scaling, allowing floating-point noise below 0.01 CSS pixels.
  await expect
    .poll(() =>
      visible.evaluateAll((elements) =>
        Math.min(
          ...elements.flatMap((element) => {
            const rect = element.getBoundingClientRect();
            return [rect.width, rect.height].map(
              (value) => Math.round(value * 100) / 100,
            );
          }),
        ),
      ),
    )
    .toBeGreaterThanOrEqual(48);
  const bounds = await visible.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return {
        label:
          element.getAttribute("aria-label") ||
          element.textContent?.trim() ||
          element.tagName,
        x,
        y,
        width,
        height,
      };
    }),
  );
  for (const bound of bounds) {
    expect(
      Math.round(bound.width * 100) / 100,
      `${name}: ${bound.label} width`,
    ).toBeGreaterThanOrEqual(48);
    expect(
      Math.round(bound.height * 100) / 100,
      `${name}: ${bound.label} height`,
    ).toBeGreaterThanOrEqual(48);
  }
  expectNoOverlap(bounds, name);
  const path = info.outputPath(`${name}-bounds.json`);
  await writeFile(path, JSON.stringify(bounds, null, 2));
  await info.attach(`${name}-bounds`, {
    path,
    contentType: "application/json",
  });
}

type TargetBounds = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function expectNoOverlap(bounds: TargetBounds[], name: string) {
  // Compare actual target rectangles, including targets outside the viewport.
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i],
        b = bounds[j];
      const overlapWidth =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapHeight =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(
        overlapWidth > 0.5 && overlapHeight > 0.5,
        `${name}: overlapping targets ${a.label} / ${b.label}`,
      ).toBe(false);
    }
  }
}

export async function waitForGallery(page: Page, dialog: Locator) {
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
        ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            ).length,
      ),
    )
    .toBe(0);
}
