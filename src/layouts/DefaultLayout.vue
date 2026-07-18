<script setup lang="ts">
import { ref } from 'vue'

const MIN_WIDTH = 200
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 280

const sidebarWidth = ref(DEFAULT_WIDTH)
const isSidebarCollapsed = ref(false)
const isDragging = ref(false)

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function startDrag(e: MouseEvent) {
  e.preventDefault()
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX))
  sidebarWidth.value = newWidth
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

defineExpose({ toggleSidebar })
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-surface" :class="{ 'select-none': isDragging }">
    <!-- Sidebar -->
    <aside
      class="flex-shrink-0 bg-surface-alt overflow-hidden transition-all"
      :class="isDragging ? 'duration-0' : 'duration-200'"
      :style="{ width: isSidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
    >
      <div class="h-full overflow-y-auto" :style="{ width: `${sidebarWidth}px` }">
        <slot name="sidebar" />
      </div>
    </aside>

    <!-- Resize handle -->
    <div
      v-if="!isSidebarCollapsed"
      class="w-1 flex-shrink-0 cursor-col-resize hover:bg-accent transition-colors relative group"
      :class="isDragging ? 'bg-accent' : 'bg-border'"
      @mousedown="startDrag"
    >
      <div class="absolute inset-y-0 -left-1 -right-1" />
    </div>

    <!-- Main content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot name="content" />
    </main>
  </div>
</template>
