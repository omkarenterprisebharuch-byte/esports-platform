"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme, theme, setTheme } = useTheme();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Simple toggle button */}
      <button
        onClick={toggleTheme}
        className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 
                   hover:bg-gray-200 dark:hover:bg-gray-700
                   transition-all duration-200 hover:scale-105 active:scale-95
                   focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
        title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
        aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
      >
        {/* Sun icon (shown in dark mode) */}
        <svg
          className={`w-5 h-5 text-yellow-500 transition-all duration-300 
                     ${resolvedTheme === "dark" ? "opacity-100 rotate-0" : "opacity-0 rotate-90 absolute"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        
        {/* Moon icon (shown in light mode) */}
        <svg
          className={`w-5 h-5 text-gray-700 dark:text-gray-300 transition-all duration-300 
                     ${resolvedTheme === "light" ? "opacity-100 rotate-0" : "opacity-0 -rotate-90 absolute"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </button>

      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
          {resolvedTheme} mode
        </span>
      )}
    </div>
  );
}

// Extended theme selector with system option
export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ),
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                     transition-all duration-200
                     ${
                       theme === option.value
                         ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                         : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                     }`}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
