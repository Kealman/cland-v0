import type { Page } from 'playwright-core';

/** Mechanical spec check: rendered text nodes, excluding tooltips and keys help. */
export async function visibleProse(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? '';
      if (!text || !parent || parent.closest('[role="tooltip"], [data-keys-help], script, style, template, noscript')) continue;
      if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (!Array.from(range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth)) continue;
      if (text.endsWith('.') || text.split(/\s+/u).length > 6) failures.push(text);
    }
    return failures;
  });
}
