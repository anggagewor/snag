import { computed } from 'vue'

const isMac = navigator.platform.toUpperCase().includes('MAC') ||
  navigator.userAgent.toUpperCase().includes('MAC')

export function usePlatform() {
  const modifierKey = computed(() => isMac ? '⌘' : 'Ctrl')
  const modifierLabel = computed(() => isMac ? 'Cmd' : 'Ctrl')

  function formatShortcut(key: string): string {
    return `${modifierKey.value}${key}`
  }

  function formatShortcutLabel(key: string): string {
    return `${modifierLabel.value}+${key}`
  }

  return {
    isMac,
    modifierKey,
    modifierLabel,
    formatShortcut,
    formatShortcutLabel,
  }
}
