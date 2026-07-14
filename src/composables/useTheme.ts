import { ref, watch } from 'vue'

import type { ThemeMode } from '@/types/common'

const themeMode = ref<ThemeMode>('system')

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  // Initialize from localStorage
  const stored = localStorage.getItem('snag-theme') as ThemeMode | null
  if (stored) {
    themeMode.value = stored
  }
  applyTheme(themeMode.value)

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode.value === 'system') {
      applyTheme('system')
    }
  })

  watch(themeMode, (mode) => {
    localStorage.setItem('snag-theme', mode)
    applyTheme(mode)
  })

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
  }

  return {
    themeMode,
    setTheme,
  }
}
