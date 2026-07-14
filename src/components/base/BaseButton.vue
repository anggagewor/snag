<script setup lang="ts">
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
}>()
</script>

<template>
  <button
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      // Variants
      variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
      variant === 'secondary' && 'bg-surface-alt text-primary border border-border hover:bg-surface-hover',
      variant === 'ghost' && 'text-secondary hover:bg-surface-hover hover:text-primary',
      variant === 'danger' && 'bg-error text-white hover:bg-error/90',
      !variant && 'bg-accent text-white hover:bg-accent-hover',
      // Sizes
      size === 'sm' && 'px-2 py-1 text-xs gap-1',
      size === 'lg' && 'px-4 py-2.5 text-base gap-2',
      (!size || size === 'md') && 'px-3 py-1.5 text-sm gap-1.5',
    ]"
  >
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
