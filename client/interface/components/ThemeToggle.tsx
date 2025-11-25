import { useState, useEffect } from "react";

// Using srcl themes: theme-black-green (phosphor/dark) and theme-light
export type Theme = "phosphor" | "light" | "system";

// Type guard for validating theme values
function isValidTheme(value: string | null): value is Theme {
  return value !== null && ["phosphor", "light", "system"].includes(value);
}

// Map our theme names to srcl theme classes
const SRCL_THEME_CLASS: Record<Exclude<Theme, "system">, string> = {
  phosphor: "theme-black-green",
  light: "theme-light",
};

export const useTheme = () => {
  // Default to "system" so new users get their OS preference
  const [theme, setTheme] = useState<Theme>("system");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (isValidTheme(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // Apply theme to document html and body
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    // Remove all srcl theme classes from both
    html.classList.remove("theme-black-green", "theme-light");
    body.classList.remove("theme-black-green", "theme-light");

    let themeClass: string;
    if (theme === "system") {
      // Use system preference
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      themeClass = prefersDark ? "theme-black-green" : "theme-light";
    } else {
      themeClass = SRCL_THEME_CLASS[theme];
    }

    // Add to both html and body for CSS variable inheritance
    // Also add Iosevka Term font class
    html.classList.add(themeClass, "font-use-iosevka-term");
    body.classList.add(themeClass, "font-use-iosevka-term");

    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const themeClass = e.matches ? "theme-black-green" : "theme-light";
      document.documentElement.classList.remove(
        "theme-black-green",
        "theme-light"
      );
      document.body.classList.remove("theme-black-green", "theme-light");
      document.documentElement.classList.add(
        themeClass,
        "font-use-iosevka-term"
      );
      document.body.classList.add(themeClass, "font-use-iosevka-term");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return {
    theme,
    setTheme: setThemeValue,
  };
};
