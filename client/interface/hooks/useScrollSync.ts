import { useCallback, useEffect, useRef } from "react";
import {
  getElementTargetTop,
  getPrefersReducedMotion,
  isAtBottom,
} from "../utils/scrolling";

type AlignMode = "nearest" | "top";
type ScrollReason =
  | "nav-up-down"
  | "nav-left-right"
  | "generation"
  | "edit-save"
  | "map-select"
  | "mode-exit-map";

interface QueueScrollArgs {
  nodeId: string;
  align?: AlignMode;
  reason: ScrollReason;
  priority?: number;
}

interface UseScrollSyncOptions {
  containerRef: React.RefObject<HTMLElement>;
  padding?: number;
  prefersReducedMotion?: boolean;
}

/**
 * Centralized LOOM scroll orchestrator with:
 * - Leap-and-settle for long distances
 * - Reduced motion handling
 * - Intent priorities and cancellation
 * - Manual scroll guard (for generation-induced auto-scrolls)
 */
export function useScrollSync({
  containerRef,
  padding = 8,
  prefersReducedMotion,
}: UseScrollSyncOptions) {
  // Tuning constants (can be tweaked for feel)
  const SMALL_THRESHOLD = 150; // px, use standard smooth when below
  const MANUAL_SUPPRESS_MS = 2000; // ms, manual scroll guard window for generation

  const reducedMotionRef = useRef<boolean>(
    prefersReducedMotion ?? getPrefersReducedMotion(),
  );
  // Track last manual scroll time (to suppress generation-induced scrolls)
  const lastManualScrollAtRef = useRef<number>(0);
  // Track programmatic scroll windows to avoid flagging manual scroll
  const programmaticUntilRef = useRef<number>(0);

  // Track in-flight intent (priority and cancel tokens)
  const currentPriorityRef = useRef<number>(-Infinity);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);

  const clearRafs = useCallback(() => {
    if (raf1Ref.current != null) {
      cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = null;
    }
    if (raf2Ref.current != null) {
      cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
    }
  }, []);

  const setProgrammaticWindow = useCallback((ms: number = 250) => {
    programmaticUntilRef.current = Date.now() + ms;
  }, []);

  // Attach a scroll listener to detect manual scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const now = Date.now();
      // Ignore programmatic scrolls within a short window after we set scrollTop/scrollTo
      if (now <= programmaticUntilRef.current) return;
      lastManualScrollAtRef.current = now;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [containerRef]);

  const cancel = useCallback(() => {
    clearRafs();
    currentPriorityRef.current = -Infinity;
  }, [clearRafs]);

  const queueScroll = useCallback(
    ({ nodeId, align = "nearest", reason, priority = 0 }: QueueScrollArgs) => {
      const container = containerRef.current;
      if (!container) return;

      // Respect priority: ignore if lower than current in-flight intent
      if (priority < currentPriorityRef.current) return;

      // Generation manual scroll guard: suppress if user scrolled recently and is not at bottom
      if (reason === "generation") {
        const recentManual =
          Date.now() - lastManualScrollAtRef.current < MANUAL_SUPPRESS_MS;
        if (recentManual && !isAtBottom(container)) {
          return;
        }
      }

      // Cancel any pending animation frames from previous intents
      cancel();
      currentPriorityRef.current = priority;

      // Find the element by data-node-id within the LOOM container
      const el = container.querySelector(
        `[data-node-id="${CSS.escape(nodeId)}"]`,
      ) as HTMLElement | null;

      if (!el) {
        // Nothing to do if the element isn't in DOM yet
        // Callers can retry on next frame if needed.
        return;
      }

      const effectiveAlign: AlignMode =
        el.offsetHeight >= container.clientHeight ? "top" : align;

      // Compute target scrollTop
      const targetTop = getElementTargetTop(
        container,
        el,
        padding,
        effectiveAlign,
      );

      // No need to adjust if already aligned effectively
      const currentTop = container.scrollTop;
      if (Math.abs(targetTop - currentTop) <= 1) {
        return;
      }

      const reduced = reducedMotionRef.current;
      const distance = Math.abs(targetTop - currentTop);

      // Mark next scrolls as programmatic to avoid tripping the manual guard
      setProgrammaticWindow();

      if (reduced) {
        // Instant jump for reduced motion
        container.scrollTop = Math.max(0, targetTop);
        // Programmatic again (due to scroll event firing)
        setProgrammaticWindow();
        return;
      }

      // Short distance: standard smooth
      if (distance < SMALL_THRESHOLD) {
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        setProgrammaticWindow();
        return;
      }

      // Leap-and-settle disabled: fall through to single smooth scroll

      // Mid-range distance: a single smooth scroll feels right
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      setProgrammaticWindow();
    },
    [containerRef, padding, cancel, setProgrammaticWindow],
  );

  return { queueScroll, cancel };
}
