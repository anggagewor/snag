<script setup lang="ts">
import { ref } from 'vue'

const SIDEBAR_WIDTH = 280
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
      :style="{ width: isSidebarCollapsed ? '0px' : `${SIDEBAR_WIDTH}px` }"
    >
      <div class="h-full overflow-y-auto" :style="{ width: `${SIDEBAR_WIDTH}px` }">
        <slot name="sidebar" />
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot name="content" />
    </main>
  </div>
</template>
