import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openMenu(
  page: Page,
  buttonName: string,
  itemName: string,
) {
  const item = page.getByRole("menuitem", { name: itemName, exact: true });
  // SSR buttons are visible before idle hydration attaches their handlers.
  // Retry opening until interactive, without toggling an already open menu shut.
  await expect(async () => {
    if (!(await item.isVisible())) {
      await page.getByRole("button", { name: buttonName, exact: true }).click();
    }
    await expect(item).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  return item;
}
