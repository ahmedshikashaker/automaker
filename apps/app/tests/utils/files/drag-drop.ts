import { Page } from "@playwright/test";

/**
 * Simulate drag and drop of a file onto an element
 */
export async function simulateFileDrop(
  page: Page,
  targetSelector: string,
  fileName: string,
  fileContent: string,
  mimeType: string = "text/plain"
): Promise<void> {
  await page.evaluate(
    ({ selector, content, name, mime }) => {
      const target = document.querySelector(selector);
      if (!target) throw new Error(`Element not found: ${selector}`);

      const file = new File([content], name, { type: mime });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Dispatch drag events
      target.dispatchEvent(
        new DragEvent("dragover", {
          dataTransfer,
          bubbles: true,
        })
      );
      target.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer,
          bubbles: true,
        })
      );
    },
    { selector: targetSelector, content: fileContent, name: fileName, mime: mimeType }
  );
}
