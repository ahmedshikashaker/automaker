import { Page } from "@playwright/test";
import { clickElement } from "../core/interactions";
import { waitForElement } from "../core/waiting";

/**
 * Navigate to the board/kanban view
 */
export async function navigateToBoard(page: Page): Promise<void> {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Check if we're on the board view already
  const boardView = page.locator('[data-testid="board-view"]');
  const isOnBoard = await boardView.isVisible().catch(() => false);

  if (!isOnBoard) {
    // Try to click on a recent project first (from welcome screen)
    const recentProject = page.locator('p:has-text("Test Project")').first();
    if (await recentProject.isVisible().catch(() => false)) {
      await recentProject.click();
      await page.waitForTimeout(200);
    }

    // Then click on Kanban Board nav button to ensure we're on the board
    const kanbanNav = page.locator('[data-testid="nav-board"]');
    if (await kanbanNav.isVisible().catch(() => false)) {
      await kanbanNav.click();
    }
  }

  // Wait for the board view to be visible
  await waitForElement(page, "board-view", { timeout: 10000 });
}

/**
 * Navigate to the context view
 */
export async function navigateToContext(page: Page): Promise<void> {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click on the Context nav button
  const contextNav = page.locator('[data-testid="nav-context"]');
  if (await contextNav.isVisible().catch(() => false)) {
    await contextNav.click();
  }

  // Wait for the context view to be visible
  await waitForElement(page, "context-view", { timeout: 10000 });
}

/**
 * Navigate to the spec view
 */
export async function navigateToSpec(page: Page): Promise<void> {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click on the Spec nav button
  const specNav = page.locator('[data-testid="nav-spec"]');
  if (await specNav.isVisible().catch(() => false)) {
    await specNav.click();
  }

  // Wait for the spec view to be visible
  await waitForElement(page, "spec-view", { timeout: 10000 });
}

/**
 * Navigate to the agent view
 */
export async function navigateToAgent(page: Page): Promise<void> {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click on the Agent nav button
  const agentNav = page.locator('[data-testid="nav-agent"]');
  if (await agentNav.isVisible().catch(() => false)) {
    await agentNav.click();
  }

  // Wait for the agent view to be visible
  await waitForElement(page, "agent-view", { timeout: 10000 });
}

/**
 * Navigate to the settings view
 */
export async function navigateToSettings(page: Page): Promise<void> {
  await page.goto("/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click on the Settings button in the sidebar
  const settingsButton = page.locator('[data-testid="settings-button"]');
  if (await settingsButton.isVisible().catch(() => false)) {
    await settingsButton.click();
  }

  // Wait for the settings view to be visible
  await waitForElement(page, "settings-view", { timeout: 10000 });
}

/**
 * Navigate to the setup view directly
 * Note: This function uses setupFirstRun from project/setup to avoid circular dependency
 */
export async function navigateToSetup(page: Page): Promise<void> {
  // Dynamic import to avoid circular dependency
  const { setupFirstRun } = await import("../project/setup");
  await setupFirstRun(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForElement(page, "setup-view", { timeout: 10000 });
}

/**
 * Navigate to the welcome view (clear project selection)
 */
export async function navigateToWelcome(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForElement(page, "welcome-view", { timeout: 10000 });
}

/**
 * Navigate to a specific view using the sidebar navigation
 */
export async function navigateToView(
  page: Page,
  viewId: string
): Promise<void> {
  const navSelector =
    viewId === "settings" ? "settings-button" : `nav-${viewId}`;
  await clickElement(page, navSelector);
  await page.waitForTimeout(100);
}

/**
 * Get the current view from the URL or store (checks which view is active)
 */
export async function getCurrentView(page: Page): Promise<string | null> {
  // Get the current view from zustand store via localStorage
  const storage = await page.evaluate(() => {
    const item = localStorage.getItem("automaker-storage");
    return item ? JSON.parse(item) : null;
  });

  return storage?.state?.currentView || null;
}
