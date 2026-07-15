<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useTheme } from '@/composables/useTheme'
import { useKeyboard } from '@/composables/useKeyboard'
import { useCollectionsStore } from '@/stores/collections'
import { useEnvironmentsStore } from '@/stores/environments'
import { useHistoryStore } from '@/stores/history'
import { useSettingsStore } from '@/stores/settings'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import SidebarPanel from '@/features/sidebar/SidebarPanel.vue'
import TabBar from '@/features/tabs/TabBar.vue'
import TabContent from '@/features/tabs/TabContent.vue'

// Initialize theme
const { loadTheme } = useTheme()

// Register keyboard shortcuts
useKeyboard()

// Layout ref for sidebar toggle
const layoutRef = ref<InstanceType<typeof DefaultLayout> | null>(null)

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
  })
})

// Load persisted data
const collectionsStore = useCollectionsStore()
const environmentsStore = useEnvironmentsStore()
const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await Promise.all([
    collectionsStore.load(),
    environmentsStore.load(),
    historyStore.load(),
    settingsStore.load(),
    loadTheme(),
  ])
})
</script>

<template>
  <DefaultLayout ref="layoutRef">
    <template #sidebar>
      <SidebarPanel />
    </template>
    <template #content>
      <TabBar />
      <TabContent />
    </template>
  </DefaultLayout>
</template>
