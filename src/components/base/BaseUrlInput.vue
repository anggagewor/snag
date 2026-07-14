<script setup lang="ts">
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
}>()
</script>

<template>
  <BaseEnvInput
    :model-value="modelValue"
    :placeholder="placeholder || 'Enter request URL...'"
    monospace
    @update:model-value="emit('update:modelValue', $event)"
    @keydown.meta.enter="emit('send')"
  />
</template>
