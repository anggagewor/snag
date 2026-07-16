<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useTheme } from '@/composables/useTheme'
import { useKeyboard } from '@/composables/useKeyboard'
import { useCollectionsStore } from '@/stores/collections'
import { useEnvironmentsStore } from '@/stores/environments'
import { useHistoryStore } from '@/stores/history'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import SidebarPanel from '@/features/sidebar/SidebarPanel.vue'
import TabBar from '@/features/tabs/TabBar.vue'
import TabContent from '@/features/tabs/TabContent.vue'
import BaseErrorBoundary from '@/components/base/BaseErrorBoundary.vue'
import SearchPalette from '@/features/search/SearchPalette.vue'

// Initialize theme
const { loadTheme } = useTheme()

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

// Load persisted data
const collectionsStore = useCollectionsStore()
const environmentsStore = useEnvironmentsStore()
const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()

onMounted(async () => {
  await Promise.all([
    collectionsStore.load(),
    environmentsStore.load(),
    historyStore.load(),
    settingsStore.load(),
    tabsStore.load(),
    loadTheme(),
  ])
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
  </BaseErrorBoundary>
</template>
