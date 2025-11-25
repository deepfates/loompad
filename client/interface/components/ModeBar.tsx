interface ModeBarProps {
  title: string;
  hint?: string;
}

export const ModeBar = ({ title, hint }: ModeBarProps) => (
  <div
    className="mode-bar flex items-center justify-between gap-2 border-b border-solid border-theme-border min-w-0 overflow-hidden flex-shrink-0"
    style={{ padding: "1ch" }}
    role="region"
    aria-label={`${title} mode`}
  >
    <strong className="font-bold tracking-[0.05em]">{title}</strong>
    {hint && (
      <span className="opacity-70 text-right flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {hint}
      </span>
    )}
  </div>
);

export default ModeBar;
