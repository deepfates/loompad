import type { StoryNode } from "../types";

// Constants for scroll configuration
const SCROLL_PADDING = 80;
const MIN_MENU_ITEM_HEIGHT = 40;
const DEFAULT_MENU_ITEM_HEIGHT = 60;
const SCROLL_DEBOUNCE_DELAY = 150;

/**
 * Scrolls to a specific text position in a story container
 */
export function scrollToTextPosition(
  container: HTMLElement,
  position: number,
  smooth: boolean = true,
) {
  if (!container || position < 0) return;

  try {
    // Create a temporary span to measure the position
    const temp = document.createElement("span");
    temp.style.whiteSpace = "pre-wrap";
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    temp.style.fontSize = getComputedStyle(container).fontSize;
    temp.style.fontFamily = getComputedStyle(container).fontFamily;
    temp.style.lineHeight = getComputedStyle(container).lineHeight;
    temp.style.width = `${container.clientWidth}px`;

    const text = container.textContent || "";
    temp.textContent = text.substring(0, Math.min(position, text.length));
    document.body.appendChild(temp);

    const scrollPosition = temp.getBoundingClientRect().height;
    document.body.removeChild(temp);

    // Scroll with padding to show context
    const targetScroll = Math.max(0, scrollPosition - SCROLL_PADDING);

    if (smooth && container.scrollTo) {
      container.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    } else {
      container.scrollTop = targetScroll;
    }
  } catch (error) {
    console.warn("Error in scrollToTextPosition:", error);
    // Fallback to simple scroll
    container.scrollTop = 0;
  }
}

/**
 * Scrolls to focus on the current story depth (highlighted text)
 */
export function scrollToCurrentDepth(
  container: HTMLElement,
  path: StoryNode[],
  currentDepth: number,
  smooth: boolean = true,
) {
  if (!container || !path || currentDepth < 0) return;

  // Calculate the position to scroll to the current depth
  let position = 0;
  for (let i = 0; i < Math.min(currentDepth, path.length); i++) {
    if (path[i]?.text) {
      position += path[i].text.length;
    }
  }

  scrollToTextPosition(container, position, smooth);
}

/**
 * Scrolls to focus on the selected sibling content (for left/right navigation)
 */
export function scrollToSelectedSibling(
  container: HTMLElement,
  path: StoryNode[],
  currentDepth: number,
  smooth: boolean = true,
) {
  if (!container || !path || currentDepth < 0 || currentDepth >= path.length)
    return;

  // Calculate position to the end of the selected sibling
  let position = 0;
  for (let i = 0; i <= currentDepth; i++) {
    if (path[i]?.text) {
      position += path[i].text.length;
    }
  }

  scrollToTextPosition(container, position, smooth);
}

/**
 * Scrolls to the end of the last node in the path (for new content)
 */
export function scrollToEndOfPath(
  container: HTMLElement,
  path: StoryNode[],
  smooth: boolean = true,
) {
  if (!container || !path || path.length === 0) return;

  const totalLength = path.reduce((sum, node) => {
    return sum + (node?.text?.length || 0);
  }, 0);
  scrollToTextPosition(container, totalLength, smooth);
}

/**
 * Scrolls a menu item into view if it's outside the viewport
 */
export function scrollMenuItemIntoView(
  container: HTMLElement,
  selectedIndex: number,
  itemHeight: number = 60,
  padding: number = 20,
) {
  if (!container || selectedIndex < 0) return;

  try {
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;

    const itemTop = selectedIndex * itemHeight;
    const itemBottom = itemTop + itemHeight;

    const viewportTop = scrollTop + padding;
    const viewportBottom = scrollTop + containerHeight - padding;

    let targetScroll = scrollTop;

    // Item is above viewport
    if (itemTop < viewportTop) {
      targetScroll = Math.max(0, itemTop - padding);
    }
    // Item is below viewport
    else if (itemBottom > viewportBottom) {
      targetScroll = itemBottom - containerHeight + padding;
    }

    if (targetScroll !== scrollTop && container.scrollTo) {
      container.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
    }
  } catch (error) {
    console.warn("Error in scrollMenuItemIntoView:", error);
  }
}

/**
 * Auto-scrolls to keep content visible when new text is added
 */
export function autoScrollOnNewContent(
  container: HTMLElement,
  wasAtBottom: boolean = false,
  threshold: number = 100,
) {
  // If user was at the bottom, stay at bottom
  if (wasAtBottom) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
    return;
  }

  // If user is near the bottom, scroll to show new content
  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

  if (distanceFromBottom < threshold) {
    container.scrollTo({
      top: scrollHeight - clientHeight,
      behavior: "smooth",
    });
  }
}

/**
 * Checks if the user is currently at the bottom of a scrollable container
 */
export function isAtBottom(
  container: HTMLElement,
  threshold: number = 10,
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * Debounced scroll function to prevent excessive scroll calls
 */
export function createDebouncedScroll(delay: number = SCROLL_DEBOUNCE_DELAY) {
  let timeoutId: number | null = null;

  return (fn: () => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      fn();
      timeoutId = null;
    }, delay);
  };
}

/**
 * Gets the estimated item height for menu scrolling
 */
export function getMenuItemHeight(container: HTMLElement): number {
  if (!container) return 60;

  try {
    const firstItem = container.querySelector(".menu-item");
    if (firstItem) {
      const styles = getComputedStyle(firstItem);
      const height = firstItem.getBoundingClientRect().height;
      const marginBottom = parseFloat(styles.marginBottom) || 0;
      return Math.max(MIN_MENU_ITEM_HEIGHT, height + marginBottom); // Minimum height
    }
  } catch (error) {
    console.warn("Error getting menu item height:", error);
  }
  return DEFAULT_MENU_ITEM_HEIGHT; // Default fallback
}
