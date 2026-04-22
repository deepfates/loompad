import type { ReactNode } from "react";

/**
 * Row: the single visual primitive for every menu row in the app.
 *
 * Four kinds, by channel response:
 *   - "pick":   label + cycling value.  ←→ cycles, ↵ cycles forward.
 *   - "knob":   label + numeric value.  ←→ adjusts, ↵ nudges.
 *   - "toggle": label + on/off glyph.   ←→ flips, ↵ flips.
 *   - "action": label + preview text.   ↵ activates.  No ←→.
 *
 * All rows are the same height, share the same selection fill, and emit the
 * same hover/focus affordances.  The menu above decides which kind to render
 * and owns the state; the Row just draws and reports its clicks.
 */

export type RowKind = "pick" | "knob" | "toggle" | "action";

interface BaseProps {
  label: string;
  selected: boolean;
  onActivate?: () => void;
  onHover?: () => void;
  danger?: boolean;
}

interface PickProps extends BaseProps {
  kind: "pick";
  value: string;
  /** Glyph shown when the row is selected and ←→ adjusts the value. */
  showAdjust?: boolean;
}

interface KnobProps extends BaseProps {
  kind: "knob";
  value: number;
  min: number;
  max: number;
  /** Optional pretty formatter (e.g. "∞" for max). */
  formatValue?: (v: number) => string;
}

interface ToggleProps extends BaseProps {
  kind: "toggle";
  value: boolean;
}

interface ActionProps extends BaseProps {
  kind: "action";
  /** Short preview / description, shown after a separator. */
  preview?: string;
  /** Leading glyph (+, →, etc.). */
  glyph?: string;
  /** Right-side content (icons, sub-actions). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** When true, render preview on its own line below the label. */
  stacked?: boolean;
}

export type RowProps = PickProps | KnobProps | ToggleProps | ActionProps;

const toggleGlyph = (on: boolean) => (on ? "×" : " ");
const adjustGlyph = "◄►";

export const Row = (props: RowProps) => {
  const { label, selected, onActivate, onHover, danger } = props;

  const className = [
    "menu-item",
    "menu-item--row",
    `menu-item--${props.kind}`,
    selected ? "selected" : "",
    danger ? "menu-item--danger" : "",
    props.kind === "action" && props.disabled ? "menu-item--disabled" : "",
    props.kind === "action" && props.stacked ? "menu-item--stacked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (props.kind === "action" && props.disabled) return;
    onActivate?.();
  };

  return (
    <button
      type="button"
      className={className}
      aria-selected={selected}
      onClick={handleClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      disabled={props.kind === "action" && props.disabled}
    >
      <RowContent {...props} />
    </button>
  );
};

const RowContent = (props: RowProps) => {
  switch (props.kind) {
    case "pick":
      return (
        <>
          <span className="menu-item-label">{props.label}:</span>
          <span className="menu-item-value">{props.value}</span>
          {props.selected && props.showAdjust !== false ? (
            <span className="menu-item-hint" aria-hidden="true">
              {adjustGlyph}
            </span>
          ) : null}
        </>
      );
    case "knob": {
      const display = props.formatValue
        ? props.formatValue(props.value)
        : String(props.value);
      const fraction =
        props.max > props.min
          ? (props.value - props.min) / (props.max - props.min)
          : 0;
      return (
        <>
          <span className="menu-item-label">{props.label}:</span>
          <span className="menu-item-value">{display}</span>
          <span
            className="menu-item-knob-bar"
            aria-hidden="true"
            role="presentation"
          >
            <span
              className="menu-item-knob-fill"
              style={{
                width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
              }}
            />
          </span>
          {props.selected ? (
            <span className="menu-item-hint" aria-hidden="true">
              {adjustGlyph}
            </span>
          ) : null}
        </>
      );
    }
    case "toggle":
      return (
        <>
          <span className="menu-item-toggle-box" aria-hidden="true">
            {toggleGlyph(props.value)}
          </span>
          <span className="menu-item-label">{props.label}</span>
        </>
      );
    case "action":
      return (
        <>
          {props.glyph ? (
            <span className="menu-item-glyph" aria-hidden="true">
              {props.glyph}
            </span>
          ) : null}
          <span className="menu-item-label">{props.label}</span>
          {props.preview ? (
            <span className="menu-item-preview">{props.preview}</span>
          ) : null}
          {props.trailing ? (
            <span className="menu-item-trailing">{props.trailing}</span>
          ) : null}
        </>
      );
  }
};
