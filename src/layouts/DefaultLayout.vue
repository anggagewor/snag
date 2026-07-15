<script setup lang="ts">
import { ref, computed } from 'vue'

import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const sidebarWidth = computed(() => settingsStore.settings.sidebarWidth)
const isSidebarCollapsed = ref(false)

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

defineExpose({ toggleSidebar })
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-surface">
    <!-- Sidebar -->
    <aside
      class="flex-shrink-0 border-r border-border bg-surface-alt overflow-hidden transition-all duration-200"
      :style="{ width: isSidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
    >
      <div class="h-full overflow-y-auto" :style="{ width: `${sidebarWidth}px` }">
        <slot name="sidebar" />
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot name="content" />
    </main>
  </div>
</template>
