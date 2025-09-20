// Constants for scroll configuration
const SCROLL_PADDING = 80;

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

/**
 * Scrolls to focus on the selected sibling content (for left/right navigation)
 */

/**
 * Scrolls to the end of the last node in the path (for new content)
 */

/**
 * Scrolls a menu item into view if it's outside the viewport
 */

/**
 * Auto-scrolls to keep content visible when new text is added
 */

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

/**
 * Gets the estimated item height for menu scrolling
 */

/**
 * Scroll a specific element inside a scrollable container into view
 * only if it is currently outside the visible viewport of the container.
 * - Tall elements (>= container height) are aligned to top with padding to avoid oscillation.
 */
export function scrollElementIntoViewIfNeeded(
  container: HTMLElement,
  el: HTMLElement,
  padding: number = 16,
  behavior: ScrollBehavior = "smooth",
) {
  if (!container || !el) return;

  try {
    const targetTop = getElementTargetTop(
      container,
      el,
      padding,
      // If the element is taller than the viewport, force top alignment; else use nearest
      el.offsetHeight >= container.clientHeight ? "top" : "nearest",
    );

    const scrollTop = container.scrollTop;
    if (targetTop != null) {
      const clamped = Math.max(0, targetTop);
      // Avoid micro-adjustments when already effectively in view
      if (Math.abs(clamped - scrollTop) > 1) {
        container.scrollTo({ top: clamped, behavior });
      }
    }
  } catch (error) {
    console.warn("Error in scrollElementIntoViewIfNeeded:", error);
  }
}

/**
 * Returns true if user prefers reduced motion.
 */
export function getPrefersReducedMotion(): boolean {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (
      typeof globalThis !== "undefined" &&
      typeof (globalThis as any).matchMedia === "function"
    ) {
      return (globalThis as any).matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Compute the ideal target scrollTop so that element is visible within container.
 * Mode:
 * - 'top'     => align element top to viewport with padding
 * - 'nearest' => scroll just enough to bring into view with padding
 */
export function getElementTargetTop(
  container: HTMLElement,
  el: HTMLElement,
  padding: number = 16,
  mode: "nearest" | "top" = "nearest",
): number {
  // Prefer offsetTop traversal for robust relative positioning
  const computeRelativeTop = (
    node: HTMLElement,
    stopAt: HTMLElement,
  ): { top: number; reachedStop: boolean } => {
    let top = 0;
    let cur: HTMLElement | null = node;
    while (cur && cur !== stopAt) {
      top += cur.offsetTop;
      cur = cur.offsetParent as HTMLElement | null;
    }
    return { top, reachedStop: cur === stopAt };
  };

  let { top: elementTop, reachedStop } = computeRelativeTop(el, container);
  let elementBottom = elementTop + el.offsetHeight;

  // Fallback to DOMRect if offsetParent chain didn't reach container (including null)
  if (!reachedStop) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    elementTop = scrollTop + (elRect.top - containerRect.top);
    elementBottom = elementTop + elRect.height;
  }

  const scrollTop = container.scrollTop;
  const containerHeight = container.clientHeight;

  if (mode === "top") {
    return Math.max(0, elementTop - padding);
  }

  const viewportTop = scrollTop + padding;
  const viewportBottom = scrollTop + containerHeight - padding;

  if (elementTop < viewportTop) {
    // Need to scroll up
    return Math.max(0, elementTop - padding);
  } else if (elementBottom > viewportBottom) {
    // Need to scroll down
    return Math.max(0, elementBottom - containerHeight + padding);
  }
  // Already in view (within padding)
  return scrollTop;
}

/**
 * Element-based menu scrolling with leap-and-settle for long distances.
 * Ensures the selected .menu-item is fully visible, including wrap-around cases.
 */
export function scrollMenuItemElIntoView(
  container: HTMLElement,
  el: HTMLElement,
  options?: {
    padding?: number;
  },
) {
  if (!container || !el) return;

  const padding = options?.padding ?? 12;
  const reduced = getPrefersReducedMotion();

  try {
    // Determine if scrolling is needed and compute precise target
    const targetTop = getElementTargetTop(
      container,
      el,
      padding,
      el.offsetHeight >= container.clientHeight ? "top" : "nearest",
    );

    const currentTop = container.scrollTop;
    // No movement needed (already aligned/in view)
    if (Math.abs(targetTop - currentTop) <= 1) return;

    if (reduced) {
      container.scrollTop = Math.max(0, targetTop);
      return;
    }

    // Always use native smooth scrolling for menus (no leap-and-settle)
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  } catch (error) {
    console.warn("Error in scrollMenuItemElIntoView:", error);
  }
}
