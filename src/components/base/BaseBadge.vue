<script setup lang="ts">
import { HttpMethod } from '@/types/common'

defineProps<{
  method?: HttpMethod | string
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}>()

const METHOD_CLASSES: Record<string, string> = {
  [HttpMethod.GET]: 'text-method-get bg-method-get/10',
  [HttpMethod.POST]: 'text-method-post bg-method-post/10',
  [HttpMethod.PUT]: 'text-method-put bg-method-put/10',
  [HttpMethod.PATCH]: 'text-method-patch bg-method-patch/10',
  [HttpMethod.DELETE]: 'text-method-delete bg-method-delete/10',
  [HttpMethod.HEAD]: 'text-method-head bg-method-head/10',
  [HttpMethod.OPTIONS]: 'text-method-options bg-method-options/10',
}

const VARIANT_CLASSES: Record<string, string> = {
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-error bg-error/10',
  info: 'text-info bg-info/10',
  neutral: 'text-secondary bg-surface-alt',
}
</script>

<template>
  <span
    class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold uppercase"
    :class="method ? METHOD_CLASSES[method] : (variant ? VARIANT_CLASSES[variant] : VARIANT_CLASSES.neutral)"
  >
    <slot>{{ method }}</slot>
  </span>
</template>
