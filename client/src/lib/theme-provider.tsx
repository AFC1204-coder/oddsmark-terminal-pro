import { createContext, useContext, useEffect, useState } from "react";

export type ThemePreset = "dark" | "light";

type ThemeProviderContextType = {
  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;
};

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

const presetConfig: Record<ThemePreset, { darkClass: boolean }> = {
  dark: { darkClass: true },
  light: { darkClass: false },
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreset;
}

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemePreset>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as ThemePreset;
      return stored && presetConfig[stored] ? stored : defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all theme classes
    root.classList.remove("light", "dark", "theme-terminal", "theme-bloomberg", "theme-clean");

    const config = presetConfig[theme];
    root.classList.add(config.darkClass ? "dark" : "light");

    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export const themeOptions: { value: ThemePreset; label: string; description: string }[] = [
  { value: "dark", label: "Oscuro", description: "Base profesional oscura" },
  { value: "light", label: "Blanco", description: "Base blanca para personalizar" },
];
