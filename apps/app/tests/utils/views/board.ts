import { Page, Locator } from "@playwright/test";

/**
 * Get a kanban card by feature ID
 */
export async function getKanbanCard(
  page: Page,
  featureId: string
): Promise<Locator> {
  return page.locator(`[data-testid="kanban-card-${featureId}"]`);
}

/**
 * Get a kanban column by its ID
 */
export async function getKanbanColumn(
  page: Page,
  columnId: string
): Promise<Locator> {
  return page.locator(`[data-testid="kanban-column-${columnId}"]`);
}

/**
 * Get the width of a kanban column
 */
export async function getKanbanColumnWidth(
  page: Page,
  columnId: string
): Promise<number> {
  const column = page.locator(`[data-testid="kanban-column-${columnId}"]`);
  const box = await column.boundingBox();
  return box?.width ?? 0;
}

/**
 * Check if a kanban column has CSS columns (masonry) layout
 */
export async function hasKanbanColumnMasonryLayout(
  page: Page,
  columnId: string
): Promise<boolean> {
  const column = page.locator(`[data-testid="kanban-column-${columnId}"]`);
  const contentDiv = column.locator("> div").nth(1); // Second child is the content area

  const columnCount = await contentDiv.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.columnCount;
  });

  return columnCount === "2";
}

/**
 * Drag a kanban card from one column to another
 */
export async function dragKanbanCard(
  page: Page,
  featureId: string,
  targetColumnId: string
): Promise<void> {
  const card = page.locator(`[data-testid="kanban-card-${featureId}"]`);
  const dragHandle = page.locator(`[data-testid="drag-handle-${featureId}"]`);
  const targetColumn = page.locator(
    `[data-testid="kanban-column-${targetColumnId}"]`
  );

  // Perform drag and drop
  await dragHandle.dragTo(targetColumn);
}

/**
 * Click the view output button on a kanban card
 */
export async function clickViewOutput(
  page: Page,
  featureId: string
): Promise<void> {
  // Try the running version first, then the in-progress version
  const runningBtn = page.locator(`[data-testid="view-output-${featureId}"]`);
  const inProgressBtn = page.locator(
    `[data-testid="view-output-inprogress-${featureId}"]`
  );

  if (await runningBtn.isVisible()) {
    await runningBtn.click();
  } else if (await inProgressBtn.isVisible()) {
    await inProgressBtn.click();
  } else {
    throw new Error(`View output button not found for feature ${featureId}`);
  }
}

/**
 * Check if the drag handle is visible for a specific feature card
 */
export async function isDragHandleVisibleForFeature(
  page: Page,
  featureId: string
): Promise<boolean> {
  const dragHandle = page.locator(`[data-testid="drag-handle-${featureId}"]`);
  return await dragHandle.isVisible().catch(() => false);
}

/**
 * Get the drag handle element for a specific feature card
 */
export async function getDragHandleForFeature(
  page: Page,
  featureId: string
): Promise<Locator> {
  return page.locator(`[data-testid="drag-handle-${featureId}"]`);
}
