<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  direction?: 'horizontal' | 'vertical'
  initialSplit?: number // percentage 0-100
  minSize?: number // px
}>(), {
  initialSplit: 50,
})

const splitPercent = ref(props.initialSplit)
const isDragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)

function startDrag() {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const percent = ((e.clientY - rect.top) / rect.height) * 100
  splitPercent.value = Math.max(20, Math.min(80, percent))
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
</script>

<template>
  <div
    ref="containerRef"
    class="flex flex-col h-full overflow-hidden"
    :class="{ 'select-none': isDragging }"
  >
    <div class="overflow-auto" :style="{ height: `${splitPercent}%` }">
      <slot name="top" />
    </div>
    <div
      class="h-1 bg-border hover:bg-accent cursor-row-resize flex-shrink-0 transition-colors"
      @mousedown="startDrag"
    />
    <div class="overflow-auto flex-1">
      <slot name="bottom" />
    </div>
  </div>
</template>
