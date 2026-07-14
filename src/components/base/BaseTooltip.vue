<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}>()

const isVisible = ref(false)
</script>

<template>
  <div
    class="relative inline-flex"
    @mouseenter="isVisible = true"
    @mouseleave="isVisible = false"
  >
    <slot />
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        class="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap pointer-events-none"
        :class="[
          position === 'bottom' && 'top-full mt-1 left-1/2 -translate-x-1/2',
          position === 'left' && 'right-full mr-1 top-1/2 -translate-y-1/2',
          position === 'right' && 'left-full ml-1 top-1/2 -translate-y-1/2',
          (!position || position === 'top') && 'bottom-full mb-1 left-1/2 -translate-x-1/2',
        ]"
      >
        {{ text }}
      </div>
    </Transition>
  </div>
</template>
