<script setup lang="ts">
type InputSize = 'sm' | 'md' | 'lg'

defineProps<{
  modelValue?: string
  placeholder?: string
  size?: InputSize
  disabled?: boolean
  type?: string
  monospace?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    class="w-full rounded-md border border-border bg-surface text-primary placeholder:text-muted transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      size === 'sm' && 'px-2 py-1 text-xs',
      size === 'lg' && 'px-4 py-2.5 text-base',
      (!size || size === 'md') && 'px-3 py-1.5 text-sm',
      monospace && 'font-mono',
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
