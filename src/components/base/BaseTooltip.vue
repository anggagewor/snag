<script setup lang="ts">
import { ref, useTemplateRef, computed } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  shortcut?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}>(), {
  position: 'top',
  delay: 400,
})

const isVisible = ref(false)
const triggerRef = useTemplateRef<HTMLDivElement>('trigger')
let timeout: ReturnType<typeof setTimeout> | null = null

const tooltipStyle = computed(() => {
  if (!isVisible.value || !triggerRef.value) return {}
  const rect = triggerRef.value.getBoundingClientRect()

  switch (props.position) {
    case 'bottom':
      return {
        top: `${rect.bottom + 6}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translateX(-50%)',
      }
    case 'top':
      return {
        top: `${rect.top - 6}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      }
    case 'left':
      return {
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.left - 6}px`,
        transform: 'translate(-100%, -50%)',
      }
    case 'right':
      return {
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.right + 6}px`,
        transform: 'translateY(-50%)',
      }
  }
})

function show() {
  timeout = setTimeout(() => {
    isVisible.value = true
  }, props.delay)
}

function hide() {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  isVisible.value = false
}
</script>

<template>
  <div
    ref="trigger"
    class="inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
  >
    <slot />
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        class="fixed z-[9999] px-2 py-1.5 rounded shadow-lg pointer-events-none bg-gray-900 dark:bg-gray-700 border border-gray-700 dark:border-gray-600"
        :style="tooltipStyle"
      >
        <span class="text-[11px] text-white whitespace-nowrap">{{ text }}</span>
        <kbd
          v-if="shortcut"
          class="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-300 bg-gray-800 dark:bg-gray-600 rounded"
        >
          {{ shortcut }}
        </kbd>
      </div>
    </Transition>
  </Teleport>
</template>
