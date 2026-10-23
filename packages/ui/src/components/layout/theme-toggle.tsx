"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/button";

const THEME_STORAGE_KEY = "subboost-theme";
const THEME_SCRIPT = `
(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const dark = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}

export function ThemeToggle() {
  const toggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    root.style.colorScheme = nextDark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextDark ? "dark" : "light");
    } catch {}
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="切换深浅主题"
      title="切换深浅主题"
      onClick={toggleTheme}
    >
      <Moon aria-hidden="true" className="dark:hidden" />
      <Sun aria-hidden="true" className="hidden dark:block" />
    </Button>
  );
}
