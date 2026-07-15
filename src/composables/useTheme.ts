import { ref, watch } from 'vue'

import { useStorage } from '@/composables/useStorage'
import type { ThemeMode } from '@/types/common'

const themeMode = ref<ThemeMode>('system')
let initialized = false

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  const { read, write } = useStorage()

  if (!initialized) {
    initialized = true

    // Listen for system theme changes (singleton — only once)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themeMode.value === 'system') {
        applyTheme('system')
      }
    })

    watch(themeMode, (mode) => {
      write('theme.json', { theme: mode })
      applyTheme(mode)
    })
  }

  applyTheme(themeMode.value)

  async function loadTheme() {
    const data = await read<{ theme: ThemeMode }>('theme.json', { theme: 'system' })
    themeMode.value = data.theme
    applyTheme(themeMode.value)
  }

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
  }

  return {
    themeMode,
    setTheme,
    loadTheme,
  }
}
