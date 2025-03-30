'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={`px-3 py-1 rounded ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
        title="Light mode"
      >
        🌞
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-3 py-1 rounded ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
        title="Dark mode"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`px-3 py-1 rounded ${theme === 'system' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
        title="System theme"
      >
        💻
      </button>
    </div>
  )
}