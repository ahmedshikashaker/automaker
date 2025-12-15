import { Page, Locator } from "@playwright/test";

/**
 * Perform a drag and drop operation that works with @dnd-kit
 * This uses explicit mouse movements with pointer events
 */
export async function dragAndDropWithDndKit(
  page: Page,
  sourceLocator: Locator,
  targetLocator: Locator
): Promise<void> {
  const sourceBox = await sourceLocator.boundingBox();
  const targetBox = await targetLocator.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Could not find source or target element bounds");
  }

  // Start drag from the center of the source element
  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;

  // End drag at the center of the target element
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  // Perform the drag and drop with pointer events
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(150); // Give dnd-kit time to recognize the drag
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.waitForTimeout(100); // Allow time for drop detection
  await page.mouse.up();
}
