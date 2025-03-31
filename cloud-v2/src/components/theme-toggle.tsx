'use client'

import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="w-full max-w-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Display Settings</h2>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${theme === 'light'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                }`}
            >
              🌞 Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${theme === 'dark'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                }`}
            >
              🌙 Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${theme === 'system'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                }`}
            >
              💻 System
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}