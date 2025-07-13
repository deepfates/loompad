import { useState, useEffect } from "react";

export type Theme = "matrix" | "light" | "system";

// Type guard for validating theme values
function isValidTheme(value: string | null): value is Theme {
  return value !== null && ["matrix", "light", "system"].includes(value);
}

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>("system");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (isValidTheme(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // Apply theme to document body
  useEffect(() => {
    const body = document.body;

    // Remove all theme classes
    body.classList.remove("theme-light", "theme-system");

    // Add appropriate theme class
    if (theme === "light") {
      body.classList.add("theme-light");
    } else if (theme === "system") {
      body.classList.add("theme-system");
    }
    // matrix theme is the default (no class needed)

    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return {
    theme,
    setTheme: setThemeValue,
  };
};
