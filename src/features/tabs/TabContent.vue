<script setup lang="ts">
import { watch } from 'vue'

import { Loader2, AlertCircle } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import RequestPanel from '@/features/request/RequestPanel.vue'
import SettingsPanel from '@/features/settings/SettingsPanel.vue'
import EnvironmentPanel from '@/features/environments/EnvironmentPanel.vue'
import CookiePanel from '@/features/cookies/CookiePanel.vue'

const tabsStore = useTabsStore()

// Lazy-load draft when tab activates with undefined requestDraft
watch(
  () => tabsStore.activeTab,
  (tab) => {
    if (tab && tab.type === 'request' && tab.requestId && tab.requestDraft === undefined && !tab.isError) {
      tabsStore.loadTabDraft(tab.id)
    }
  },
  { immediate: true },
)
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

    <!-- Error state -->
    <div
      v-else-if="tabsStore.activeTab.type === 'request' && tabsStore.activeTab.isError"
      class="h-full flex flex-col items-center justify-center text-muted"
    >
      <AlertCircle class="w-10 h-10 text-error/60 mb-3" :stroke-width="1.5" />
      <p class="text-sm text-error">{{ tabsStore.activeTab.errorMessage || 'Failed to load request' }}</p>
      <p class="text-xs mt-1">The request may have been deleted or the workspace file is missing.</p>
    </div>

    <!-- Loading state (draft not yet loaded) -->
    <div
      v-else-if="tabsStore.activeTab.type === 'request' && tabsStore.activeTab.requestId && !tabsStore.activeTab.requestDraft"
      class="h-full flex flex-col items-center justify-center text-muted"
    >
      <Loader2 class="w-6 h-6 animate-spin text-accent mb-2" />
      <p class="text-xs">Loading request...</p>
    </div>

    <!-- Active tab content -->
    <RequestPanel v-else-if="tabsStore.activeTab.type === 'request'" :tab="tabsStore.activeTab" />
    <SettingsPanel v-else-if="tabsStore.activeTab.type === 'settings'" />
    <EnvironmentPanel v-else-if="tabsStore.activeTab.type === 'environments'" />
    <CookiePanel v-else-if="tabsStore.activeTab.type === 'cookies'" />
  </div>
</template>
