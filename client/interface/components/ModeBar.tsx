interface ModeBarProps {
  title: string;
  hint?: string;
}

export const ModeBar = ({ title, hint }: ModeBarProps) => (
  <div className="mode-bar" role="region" aria-label={`${title} mode`}>
    <div className="mode-title">{title}</div>
    {hint && <div className="mode-hint">{hint}</div>}
  </div>
);

export default ModeBar;

