interface ModeBarProps {
  title: string;
  hint?: string;
}

/**
 * Top strip of the terminal screen.  Title is pinned to the left at a
 * fixed flex basis; hint flows on the right with horizontal overflow
 * hidden behind a gradient mask so it can carry a long chord legend on
 * desktop and still drop gracefully on mobile (user can touch-scroll
 * the hint row horizontally to see what's clipped).  Explicit gap
 * between the two so the title never butts up against the chord text.
 */
export const ModeBar = ({ title, hint }: ModeBarProps) => (
  <div
    className="mode-bar"
    role="region"
    aria-label={`${title} mode`}
  >
    <strong className="mode-bar-title">{title}</strong>
    {hint && <span className="mode-bar-hint" aria-label="controls">{hint}</span>}
  </div>
);

export default ModeBar;
