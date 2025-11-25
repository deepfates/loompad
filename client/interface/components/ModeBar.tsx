interface ModeBarProps {
  title: string;
  hint?: string;
}

export const ModeBar = ({ title, hint }: ModeBarProps) => (
  <div className="mode-bar" role="region" aria-label={`${title} mode`}>
    <strong className="mode-title">{title}</strong>
    {hint && <span className="mode-hint">{hint}</span>}
  </div>
);

export default ModeBar;
