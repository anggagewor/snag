<script setup lang="ts">
defineProps<{
  active?: boolean
  closable?: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <button
    class="relative flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
    :class="[
      active
        ? 'border-accent text-primary'
        : 'border-transparent text-secondary hover:text-primary hover:bg-surface-hover',
    ]"
  >
    <slot />
    <span
      v-if="closable"
      class="ml-1 rounded-sm p-0.5 hover:bg-surface-hover text-muted hover:text-primary"
      @click.stop="$emit('close')"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  </button>
</template>
