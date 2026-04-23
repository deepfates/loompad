const FALLBACK_THEME_COLOR = "#111827";

export const onHandleThemeChange = (themeClass: string) => {
  if (typeof document === "undefined") return;

  const meta = document.querySelector('meta[name="theme-color"]');
  const isLightTheme =
    themeClass.includes("theme-light") ||
    themeClass.includes("theme-win95") ||
    themeClass.includes("theme-macos9") ||
    themeClass.includes("theme-aperture") ||
    themeClass.includes("theme-westworld") ||
    themeClass.includes("theme-blue");

  const color = isLightTheme ? "#f3f4f6" : FALLBACK_THEME_COLOR;
  if (meta) {
    meta.setAttribute("content", color);
  }
};
