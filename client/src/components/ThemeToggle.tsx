import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  if (!toggleTheme) return null;

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className={`w-9 h-9 rounded-full flex items-center justify-center border border-transparent hover:border-border hover:bg-secondary transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
