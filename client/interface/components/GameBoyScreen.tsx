import { ReactNode } from "react";

import ModeBar from "./ModeBar";
import { MenuScreen } from "./MenuScreen";

type GameBoySurface = "menu" | "view";

interface GameBoyScreenProps {
  title: string;
  hint: string;
  variant?: GameBoySurface;
  children: ReactNode;
}

export const GameBoyScreen = ({
  title,
  hint,
  variant = "menu",
  children,
}: GameBoyScreenProps) => {
  const body =
    variant === "menu" ? (
      <MenuScreen>{children}</MenuScreen>
    ) : (
      children
    );

  return (
    <div className={`gameboy-screen gameboy-screen--${variant}`}>
      <ModeBar title={title} hint={hint} />
      <div className="gameboy-screen__body">{body}</div>
    </div>
  );
};

export default GameBoyScreen;
