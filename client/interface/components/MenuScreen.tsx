import { MenuScreenProps } from "../types";

export const MenuScreen = ({
  title,
  onClose,
  children,
  showCloseInstructions = true,
}: MenuScreenProps) => (
  <div className="menu-screen">
    {(title || showCloseInstructions) && (
      <div className="menu-header">
        {title && <h2>{title}</h2>}
        {showCloseInstructions && (
          <div className="menu-close">Press ⌫ to close</div>
        )}
      </div>
    )}
    {children}
  </div>
);
