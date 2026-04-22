import { useEffect, useRef, useState, useCallback } from "react";
import { scrollMenuItemElIntoView } from "../utils/scrolling";

/**
 * Cursor state for a vertical row list.  Owns the selected index, exposes
 * navigation handlers, and scrolls the selected row into view.
 *
 * The hook is deliberately small: it doesn't know what activates on Enter
 * or what Left/Right mean — each row owns its own behavior.  The consumer
 * only tells us the row count and (optionally) a callback to fire when
 * the index changes externally (e.g. mouse hover).
 */
export interface UseMenuCursor {
  index: number;
  setIndex: (index: number) => void;
  /** Move cursor by delta with wrap-around. */
  move: (delta: number) => void;
  /** Ref to attach to the scrollable container. Selected row is scrolled
   *  into view within this container. */
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useMenuCursor(
  count: number,
  initialIndex = 0,
): UseMenuCursor {
  const [index, setIndexRaw] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, count - 1)),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep index valid if count shrinks underneath us.
  useEffect(() => {
    if (count === 0) {
      if (index !== 0) setIndexRaw(0);
      return;
    }
    if (index >= count) setIndexRaw(count - 1);
  }, [count, index]);

  // Scroll the selected row into view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>(".menu-item");
    const el = items[index];
    if (el) scrollMenuItemElIntoView(container, el);
  }, [index]);

  const setIndex = useCallback(
    (next: number) => {
      if (count === 0) return;
      const clamped = Math.min(Math.max(0, next), count - 1);
      setIndexRaw(clamped);
    },
    [count],
  );

  const move = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndexRaw((prev) => (prev + delta + count) % count);
    },
    [count],
  );

  return { index, setIndex, move, containerRef };
}
