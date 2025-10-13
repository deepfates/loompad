import type { ReactNode } from "react";

import ModeBar from "./ModeBar";
import { MenuScreen } from "./MenuScreen";

export type GameBoyScreenVariant = "story" | "map" | "menu" | "editor";

interface GameBoyScreenProps {
  title: string;
  hint?: string;
  variant: GameBoyScreenVariant;
  children: ReactNode;
  isVisible?: boolean;
}

export const GameBoyScreen = ({
  title,
  hint,
  variant,
  children,
  isVisible = true,
}: GameBoyScreenProps) => {
  const bodyClassName = `gameboy-screen__body gameboy-screen__body--${variant} view-fade`;
  const bodyContent =
    variant === "menu" || variant === "editor" ? (
      <MenuScreen>{children}</MenuScreen>
    ) : (
      children
    );

  return (
    <div
      className={`gameboy-screen gameboy-screen--${variant}`}
      style={{ display: isVisible ? undefined : "none" }}
    >
      <ModeBar title={title} hint={hint} />
      <div className={bodyClassName}>{bodyContent}</div>
    </div>
  );
};

export default GameBoyScreen;
