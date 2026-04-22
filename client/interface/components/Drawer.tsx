import { useEffect } from "react";
import type { DrawerTab } from "../types";

/**
 * Tab strip + body shell for the configuration drawer.  Consumer owns
 * `tab` state and the tab body content; Drawer renders the chrome and
 * handles Left/Right-to-cycle-tabs when the cursor is on the tab bar.
 *
 * We use a "tab-or-rows" cursor zone convention: when `cursorOnTabs` is
 * true, Left/Right cycles tabs.  When false, Left/Right is consumed by
 * the current tab's rows (knob adjust, pick cycle, etc.).
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
  children,
}: DrawerProps) => {
  // When cursor is on the tab strip, Left/Right cycles tabs at the
  // window level.  The parent's key router decides who gets ArrowUp/
  // ArrowDown (moving into/out of the tab zone).
  useEffect(() => {
    if (!cursorOnTabs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = DRAWER_TABS.findIndex((t) => t.id === tab);
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const next =
        DRAWER_TABS[
          (idx + delta + DRAWER_TABS.length) % DRAWER_TABS.length
        ];
      setTab(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursorOnTabs, tab, setTab]);

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
              onClick={() => setTab(t.id)}
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
