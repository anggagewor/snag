import { ref, watch } from 'vue'

type ThemeMode = 'light' | 'dark' | 'system'

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
  if (!initialized) {
    initialized = true

    // Listen for system theme changes (singleton — only once)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themeMode.value === 'system') {
        applyTheme('system')
      }
    })

    watch(themeMode, (mode) => {
      applyTheme(mode)
    })
  }

  applyTheme(themeMode.value)

  /**
   * Load theme from settings store.
   * Called after settingsStore.load() to sync theme state.
   */
  function loadFromSettings(theme: ThemeMode) {
    themeMode.value = theme
    applyTheme(theme)
  }

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
  }

  return {
    themeMode,
    setTheme,
    loadFromSettings,
  }
}
