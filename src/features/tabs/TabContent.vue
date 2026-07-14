<script setup lang="ts">
import { useTabsStore } from '@/stores/tabs'
import RequestPanel from '@/features/request/RequestPanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'
import EnvironmentPanel from '@/features/environments/EnvironmentPanel.vue'

const tabsStore = useTabsStore()
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <!-- Empty state -->
    <div
      v-if="!tabsStore.activeTab"
      class="h-full flex flex-col items-center justify-center text-muted"
    >
      <h1 class="text-3xl font-bold text-primary/20 mb-6 tracking-tight">Snag</h1>
      <p class="text-sm">Open a request or create a new one</p>
      <p class="text-xs mt-1">Cmd+T to open a new tab</p>
    </div>

    <!-- Active tab content -->
    <RequestPanel v-else-if="tabsStore.activeTab.type === 'request'" :tab="tabsStore.activeTab" />
    <SettingsPanel v-else-if="tabsStore.activeTab.type === 'settings'" />
    <EnvironmentPanel v-else-if="tabsStore.activeTab.type === 'environments'" />
  </div>
</template>
