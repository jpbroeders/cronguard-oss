'use client'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-center justify-center hover:border-[var(--accent)] transition-all group"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {/* Sun icon */}
      <svg
        className={`w-5 h-5 absolute transition-all duration-300 ${
          theme === 'light'
            ? 'opacity-100 rotate-0 scale-100 text-amber-500'
            : 'opacity-0 rotate-90 scale-50 text-amber-500'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>

      {/* Moon icon */}
      <svg
        className={`w-5 h-5 absolute transition-all duration-300 ${
          theme === 'dark'
            ? 'opacity-100 rotate-0 scale-100 text-indigo-400'
            : 'opacity-0 -rotate-90 scale-50 text-indigo-400'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    </button>
  )
}
