import { MenuScreenProps } from "../types";

export const MenuScreen = ({ children }: MenuScreenProps) => (
  <div className="flex-1 overflow-y-auto">{children}</div>
);
