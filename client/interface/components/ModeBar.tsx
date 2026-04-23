import { useEffect, useRef, useState } from "react";

interface ModeBarProps {
  title: string;
  hint?: string;
}

/**
 * Top strip: title pinned left, hint pinned right (space-between).
 * The hint has a capped width and scrolls horizontally when it
 * overflows; a "›" caret appears at the right edge only when there
 * is content still off-screen to scroll to.
 */
export const ModeBar = ({ title, hint }: ModeBarProps) => {
  const trackRef = useRef<HTMLSpanElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () =>
      setCanScroll(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [hint]);

  return (
    <div className="mode-bar" role="region" aria-label={`${title} mode`}>
      <strong className="mode-bar-title">{title}</strong>
      {hint && (
        <div className="mode-bar-hint-frame">
          <span className="mode-bar-hint" ref={trackRef} aria-label="controls">
            {hint}
          </span>
          <span
            className={`mode-bar-scroll-hint ${canScroll ? "is-visible" : ""}`}
            aria-hidden="true"
          >
            ›
          </span>
        </div>
      )}
    </div>
  );
};

export default ModeBar;
