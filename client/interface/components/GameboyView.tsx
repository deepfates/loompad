import type { ReactNode } from "react";

import ModeBar from "./ModeBar";
import { MenuScreen } from "./MenuScreen";

interface GameboyViewProps {
  title: string;
  hint: string;
  variant?: "story" | "menu" | "map";
  status?: ReactNode;
  children: ReactNode;
}

export const GameboyView = ({
  title,
  hint,
  variant = "story",
  status,
  children,
}: GameboyViewProps) => {
  const contentClassName = [
    "gameboy-view__content",
    variant === "menu" ? "gameboy-view__content--menu" : "",
    variant === "map" ? "gameboy-view__content--map" : "",
    variant !== "menu" ? "view-fade" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body =
    variant === "menu" ? <MenuScreen>{children}</MenuScreen> : children;

  return (
    <div className={`gameboy-view gameboy-view--${variant}`}>
      <ModeBar title={title} hint={hint} />
      <div className={contentClassName}>{body}</div>
      {status ? <div className="gameboy-view__status">{status}</div> : null}
    </div>
  );
};

export default GameboyView;
