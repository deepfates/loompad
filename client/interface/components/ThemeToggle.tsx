import { useCallback, useEffect, useMemo, useState } from "react";
import { onHandleThemeChange } from "srcl/common/utilities.ts";

export type ThemeMode = "light" | "dark" | "system";
export const THEME_PRESETS = [
  // Light
  { id: "theme-aperture", label: "Aperture", tone: "light" },
  { id: "theme-blue", label: "BSOD", tone: "light" },
  { id: "theme-light", label: "Highlight", tone: "light" },
  { id: "theme-macos9", label: "OS 9", tone: "light" },
  { id: "theme-win95", label: "W95", tone: "light" },
  { id: "theme-westworld", label: "Westworld", tone: "light" },
  // Dark
  { id: "theme-hologram", label: "Holo", tone: "dark" },
  { id: "theme-nerv", label: "NERV", tone: "dark" },
  { id: "theme-dark", label: "Midnight", tone: "dark" },
  { id: "theme-black-red", label: "Neon", tone: "dark" },
  { id: "theme-black-green", label: "Phosphor", tone: "dark" },
  { id: "theme-black-amber", label: "Sulfur", tone: "dark" },
  { id: "theme-lcars", label: "LCARS", tone: "dark" },
  { id: "theme-outrun", label: "Outrun", tone: "dark" },
] as const;

export type ThemeClass = (typeof THEME_PRESETS)[number]["id"];
export type ThemeTone = (typeof THEME_PRESETS)[number]["tone"];

const THEME_IDS = THEME_PRESETS.map((preset) => preset.id);
const THEME_TONE_MAP = THEME_PRESETS.reduce<Record<ThemeClass, ThemeTone>>(
  (acc, preset) => {
    acc[preset.id] = preset.tone;
    return acc;
  },
  {} as Record<ThemeClass, ThemeTone>
);

const STORAGE_KEY = "loompad-theme-preferences";
const FONT_STORAGE_KEY = "loompad-font";
const LEGACY_KEY = "theme";

interface ThemePreferences {
  mode: ThemeMode;
  paletteLight: ThemeClass;
  paletteDark: ThemeClass;
}

const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: "system",
  paletteLight: "theme-light",
  paletteDark: "theme-black-green",
};

type LegacyTheme = "phosphor" | "light" | "system";

const isThemeClass = (value: string | null): value is ThemeClass =>
  value !== null && (THEME_IDS as string[]).includes(value);

const isLegacyTheme = (value: string | null): value is LegacyTheme =>
  value !== null && ["phosphor", "light", "system"].includes(value);

const legacyToPreferences = (value: LegacyTheme): ThemePreferences => {
  if (value === "phosphor") {
    return { ...DEFAULT_PREFERENCES, mode: "dark" };
  }
  if (value === "light") {
    return { ...DEFAULT_PREFERENCES, mode: "light" };
  }
  return DEFAULT_PREFERENCES;
};

const ensureThemeForTone = (
  themeId: ThemeClass | undefined,
  tone: ThemeTone
): ThemeClass => {
  if (themeId && THEME_TONE_MAP[themeId] === tone) {
    return themeId;
  }
  const fallback = THEME_PRESETS.find((preset) => preset.tone === tone);
  return fallback ? fallback.id : THEME_PRESETS[0].id;
};

const normalizePreferences = (prefs: ThemePreferences): ThemePreferences => ({
  ...prefs,
  paletteLight: ensureThemeForTone(prefs.paletteLight, "light"),
  paletteDark: ensureThemeForTone(prefs.paletteDark, "dark"),
});

const resolveThemeClass = (
  prefs: ThemePreferences,
  prefersDark: boolean
): ThemeClass => {
  if (prefs.mode === "light") return prefs.paletteLight;
  if (prefs.mode === "dark") return prefs.paletteDark;
  return prefersDark ? prefs.paletteDark : prefs.paletteLight;
};

const removeThemeClasses = (element: HTMLElement) => {
  element.classList.forEach((cls) => {
    if (cls.startsWith("theme-")) {
      element.classList.remove(cls);
    }
  });
};

const removeFontClasses = (element: HTMLElement) => {
  element.classList.forEach((cls) => {
    if (cls.startsWith("font-use-")) {
      element.classList.remove(cls);
    }
  });
};

export const FONT_OPTIONS = [
  {
    id: "anonymous-pro",
    label: "Anonymous Pro",
    className: "font-use-anonymous-pro",
  },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    className: "font-use-atkinson-hyperlegible-mono",
  },
  {
    id: "berkeley",
    label: "Berkeley Mono",
    className: "font-use-berkeley-mono",
  },
  { id: "fira", label: "Fira Code", className: "font-use-fira-code" },
  { id: "iosevka", label: "Iosevka", className: "font-use-iosevka-term" },
  {
    id: "monaspace-argon",
    label: "Monaspace Argon",
    className: "font-use-monaspace-argon",
  },
  {
    id: "monaspace-krypton",
    label: "Monaspace Krypton",
    className: "font-use-monaspace-krypton",
  },
  {
    id: "monaspace-neon",
    label: "Monaspace Neon",
    className: "font-use-monaspace-neon",
  },
  {
    id: "monaspace-radon",
    label: "Monaspace Radon",
    className: "font-use-monaspace-radon",
  },
  {
    id: "monaspace-xenon",
    label: "Monaspace Xenon",
    className: "font-use-monaspace-xenon",
  },
  {
    id: "serious-shanns",
    label: "Serious Sans",
    className: "font-use-serious-shanns",
  },
  {
    id: "sfmono",
    label: "SF Mono Square",
    className: "font-use-sfmono-square",
  },
  {
    id: "share-tech",
    label: "Share Tech Mono",
    className: "font-use-share-tech-mono",
  },
  { id: "space-mono", label: "Space Mono", className: "font-use-space-mono" },
  { id: "tt2020", label: "TT2020", className: "font-use-tt2020" },
  { id: "xanh", label: "Xanh Mono", className: "font-use-xanh-mono" },
] as const;
export type FontOption = (typeof FONT_OPTIONS)[number]["id"];

const FONT_CLASS_MAP: Record<FontOption, string> = FONT_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.className;
    return acc;
  },
  {} as Record<FontOption, string>
);

const DEFAULT_FONT: FontOption = "iosevka";

export const useTheme = () => {
  const [preferences, setPreferences] = useState<ThemePreferences>(() =>
    normalizePreferences(DEFAULT_PREFERENCES)
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [resolvedTheme, setResolvedTheme] = useState<ThemeClass>(
    DEFAULT_PREFERENCES.paletteDark
  );
  const [resolvedTone, setResolvedTone] = useState<ThemeTone>(
    THEME_TONE_MAP[DEFAULT_PREFERENCES.paletteDark]
  );
  const [font, setFont] = useState<FontOption>(DEFAULT_FONT);

  // Load preferences from storage (or legacy key) once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          ["light", "dark", "system"].includes(parsed.mode) &&
          isThemeClass(parsed.paletteLight) &&
          isThemeClass(parsed.paletteDark)
        ) {
          setPreferences(normalizePreferences(parsed));
          return;
        }
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (isLegacyTheme(legacy)) {
        const prefs = legacyToPreferences(legacy);
        setPreferences(normalizePreferences(prefs));
        localStorage.removeItem(LEGACY_KEY);
      }
      const storedFont = localStorage.getItem(FONT_STORAGE_KEY);
      if (storedFont && storedFont in FONT_CLASS_MAP) {
        setFont(storedFont as FontOption);
      }
    } catch {
      // Ignore parse errors and stick with defaults
    }
  }, []);

  // Track system preference changes for "system" mode
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const applyThemeClass = useCallback(
    (themeClass: ThemeClass, fontClass: string) => {
      if (typeof document === "undefined") return;
      onHandleThemeChange(themeClass);
      const html = document.documentElement;
      removeThemeClasses(html);
      removeFontClasses(html);
      removeFontClasses(document.body);
      html.classList.add(themeClass);
      html.classList.add(fontClass);
      document.body.classList.add(fontClass);
    },
    []
  );

  const resolvedClass = useMemo(
    () => resolveThemeClass(preferences, systemPrefersDark),
    [preferences, systemPrefersDark]
  );

  // Apply resolved theme and persist preferences
  useEffect(() => {
    applyThemeClass(resolvedClass, FONT_CLASS_MAP[font]);
    setResolvedTheme(resolvedClass);
    setResolvedTone(THEME_TONE_MAP[resolvedClass]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      localStorage.setItem(FONT_STORAGE_KEY, font);
    }
  }, [resolvedClass, preferences, font, applyThemeClass]);

  const setThemeMode = (mode: ThemeMode) => {
    setPreferences((prev) => (prev.mode === mode ? prev : { ...prev, mode }));
  };

  const setLightTheme = (themeClass: ThemeClass) => {
    if (!isThemeClass(themeClass)) return;
    if (THEME_TONE_MAP[themeClass] !== "light") return;
    setPreferences((prev) =>
      prev.paletteLight === themeClass
        ? prev
        : { ...prev, paletteLight: themeClass }
    );
  };

  const setDarkTheme = (themeClass: ThemeClass) => {
    if (!isThemeClass(themeClass)) return;
    if (THEME_TONE_MAP[themeClass] !== "dark") return;
    setPreferences((prev) =>
      prev.paletteDark === themeClass
        ? prev
        : { ...prev, paletteDark: themeClass }
    );
  };

  const setFontPreference = (option: FontOption) => {
    if (!(option in FONT_CLASS_MAP)) return;
    setFont(option);
  };

  return {
    themeMode: preferences.mode,
    setThemeMode,
    lightTheme: preferences.paletteLight,
    setLightTheme,
    darkTheme: preferences.paletteDark,
    setDarkTheme,
    resolvedTheme: resolvedTheme,
    resolvedTone,
    availableThemes: THEME_PRESETS,
    font,
    setFont: setFontPreference,
    availableFonts: FONT_OPTIONS,
  };
};
