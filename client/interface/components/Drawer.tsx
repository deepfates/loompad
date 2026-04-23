import type { DrawerTab } from "../types";

/**
 * Tab strip + body shell for the configuration drawer.  Consumer owns
 * `tab` state and the tab body content.  Drawer is purely presentational:
 * keyboard routing (including ←→ to cycle tabs while cursorOnTabs) lives
 * in Interface.tsx so that on-screen D-pad and physical keys take the
 * same code path.
 */

export const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "models", label: "Models" },
  { id: "stories", label: "Stories" },
];

interface DrawerProps {
  tab: DrawerTab;
  setTab: (tab: DrawerTab) => void;
  cursorOnTabs: boolean;
  onTabActivate: () => void;
  children: React.ReactNode;
}

export const Drawer = ({
  tab,
  setTab,
  cursorOnTabs,
  onTabActivate,
  children,
}: DrawerProps) => {

  return (
    <div className="drawer">
      <div className="drawer-tabs" role="tablist" aria-label="Configuration">
        {DRAWER_TABS.map((t) => {
          const active = t.id === tab;
          const selected = cursorOnTabs && active;
          return (
            <button
              type="button"
              key={t.id}
              role="tab"
              aria-selected={active}
              className={[
                "drawer-tab",
                active ? "drawer-tab--active" : "",
                selected ? "drawer-tab--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setTab(t.id);
                // Clicking a tab should drop the tab-strip cursor so
                // the body's selection becomes visible again; without
                // this the pointer switch leaves cursorOnTabs true and
                // the body renders with no highlighted row.
                onTabActivate();
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="drawer-body" role="tabpanel">
        {children}
      </div>
    </div>
  );
};
