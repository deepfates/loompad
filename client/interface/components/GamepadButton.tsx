import {
  useRef,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import { GamepadButtonProps } from "../types";

export const GamepadButton = ({
  label,
  className = "",
  active = false,
  disabled = false,
  onPressStart,
  onPressEnd,
}: GamepadButtonProps) => {
  const isPressedRef = useRef(false);

  const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (disabled || isPressedRef.current) {
      return;
    }

    isPressedRef.current = true;
    event.preventDefault();

    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors (e.g., unsupported environments)
      }
    }

    void onPressStart();
  };

  const endPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isPressedRef.current) {
      return;
    }

    isPressedRef.current = false;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    void onPressEnd();
  };

  const handlePointerUp: PointerEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    endPress(event);
  };

  const handlePointerCancel: PointerEventHandler<HTMLButtonElement> = (event) => {
    endPress(event);
  };

  const handlePointerLeave: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (!isPressedRef.current) {
      return;
    }

    if (event.pointerType === "mouse" && event.buttons === 0) {
      // Ignore hover transitions when the mouse isn't pressed
      return;
    }

    endPress(event);
  };

  const handleContextMenu: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
  };

  return (
    <button
      type="button"
      className={`btn ${active ? "btn-primary" : "btn-ghost"} ${className}`}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      aria-pressed={active}
    >
      {label}
    </button>
  );
};
