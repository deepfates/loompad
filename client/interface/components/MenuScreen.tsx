import { MenuScreenProps } from "../types";

export const MenuScreen = ({ title, onClose, children }: MenuScreenProps) => (
  <div className="menu-screen">
    <div className="menu-header">
      <h2>{title}</h2>
      <div className="menu-close">Press ⌫ to close</div>
    </div>
    {children}
  </div>
);
