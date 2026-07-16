<script setup lang="ts">
import { onMounted, ref, inject } from 'vue'

import { useTheme } from '@/composables/useTheme'
import { useKeyboard } from '@/composables/useKeyboard'
import { useHistoryStore } from '@/stores/history'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useWorkspaceStore } from '@/stores/workspace'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import SidebarPanel from '@/features/sidebar/SidebarPanel.vue'
import TabBar from '@/features/tabs/TabBar.vue'
import TabContent from '@/features/tabs/TabContent.vue'
import BaseErrorBoundary from '@/components/base/BaseErrorBoundary.vue'
import SearchPalette from '@/features/search/SearchPalette.vue'
import ToastContainer from '@/features/notifications/ToastContainer.vue'
import ErrorModalOverlay from '@/features/notifications/ErrorModalOverlay.vue'
import type { StartupResult } from '@/services/startup'

// Initialize theme (apply system preference immediately, before settings load)
const { loadFromSettings } = useTheme()

// Register keyboard shortcuts
useKeyboard()

// Layout ref for sidebar toggle
const layoutRef = ref<InstanceType<typeof DefaultLayout> | null>(null)
const showSearchPalette = ref(false)

function handleToggleSidebar() {
  layoutRef.value?.toggleSidebar()
}

// Expose sidebar toggle to keyboard
onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      handleToggleSidebar()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      showSearchPalette.value = !showSearchPalette.value
    }
  })
})

// Startup result from main.ts (services already initialized)
const startupResult = inject<StartupResult | undefined>('startupResult')

// Load persisted data (legacy stores still needed for history, settings, tabs)
const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()

onMounted(async () => {
  // Load legacy stores that are still in use
  await Promise.all([
    historyStore.load(),
    settingsStore.load(),
    tabsStore.load(),
  ])

  // Sync theme from settings store
  loadFromSettings(settingsStore.resolved.theme)

  // Open workspace (handles collections + environments via new architecture)
  if (startupResult) {
    const pathToOpen = startupResult.migration?.workspacePath
      ?? startupResult.lastOpened?.path
      ?? startupResult.scratchPadPath

    if (pathToOpen) {
      try {
        await workspaceStore.openWorkspace(pathToOpen)
      } catch (err) {
        console.error('[App] Failed to open workspace:', err)
        try {
          await workspaceStore.openWorkspace(startupResult.scratchPadPath)
        } catch {
          // Last resort — app still renders
        }
      }
    }

    await workspaceStore.loadRecentWorkspaces()
  }
})
</script>

<template>
  <BaseErrorBoundary>
    <DefaultLayout ref="layoutRef">
      <template #sidebar>
        <SidebarPanel />
      </template>
      <template #content>
        <TabBar @toggle-sidebar="handleToggleSidebar" />
        <TabContent />
      </template>
    </DefaultLayout>
    <SearchPalette :open="showSearchPalette" @close="showSearchPalette = false" />
    <ToastContainer />
    <ErrorModalOverlay />
  </BaseErrorBoundary>
</template>
