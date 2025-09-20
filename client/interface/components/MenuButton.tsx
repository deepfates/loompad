import {
  useRef,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import { MenuButtonProps } from "../types";

export const MenuButton = ({
  label,
  active,
  onPressStart,
  onPressEnd,
}: MenuButtonProps) => {
  const isPressedRef = useRef(false);

  const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (isPressedRef.current) {
      return;
    }

    isPressedRef.current = true;
    event.preventDefault();

    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore unsupported pointer capture
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

  const handlePointerCancel: PointerEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    endPress(event);
  };

  const handlePointerLeave: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (!isPressedRef.current) {
      return;
    }

    if (event.pointerType === "mouse" && event.buttons === 0) {
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
      className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
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
