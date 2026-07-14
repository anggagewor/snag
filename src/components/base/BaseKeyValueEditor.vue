<script setup lang="ts">
import { computed } from 'vue'

import type { KeyValuePair } from '@/types/common'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const props = defineProps<{
  modelValue: KeyValuePair[]
  keyPlaceholder?: string
  valuePlaceholder?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: KeyValuePair[]]
}>()

// Always show at least one empty row
const rows = computed(() => {
  if (props.modelValue.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }]
  }
  return props.modelValue
})

function syncRows(updated: KeyValuePair[]) {
  const cleaned = updated.filter((item, i) => {
    if (i === updated.length - 1) return true
    return item.key !== '' || item.value !== ''
  })
  emit('update:modelValue', cleaned)
}

function updateRow(index: number, field: 'key' | 'value', value: string) {
  const updated = [...rows.value]
  updated[index] = { ...updated[index], [field]: value }

  // Auto-add row when typing in the last row
  const lastRow = updated[updated.length - 1]
  if (index === updated.length - 1 && (lastRow.key !== '' || lastRow.value !== '')) {
    updated.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true })
  }

  syncRows(updated)
}

function removeRow(index: number) {
  const updated = rows.value.filter((_, i) => i !== index)
  syncRows(updated.length === 0 ? [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }] : updated)
}

function toggleRow(index: number) {
  const updated = [...rows.value]
  updated[index] = { ...updated[index], enabled: !updated[index].enabled }
  syncRows(updated)
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="grid grid-cols-[32px_1fr_1fr_32px] gap-0 text-xs text-muted border-b border-border">
      <span class="px-1 py-1.5"></span>
      <span class="px-2 py-1.5 border-l border-border">Key</span>
      <span class="px-2 py-1.5 border-l border-border">Value</span>
      <span class="px-1 py-1.5 border-l border-border"></span>
    </div>

    <!-- Rows -->
    <div
      v-for="(item, index) in rows"
      :key="item.id"
      class="grid grid-cols-[32px_1fr_1fr_32px] gap-0 items-center group border-b border-border"
    >
      <!-- Checkbox -->
      <div class="flex justify-center h-full items-center">
        <input
          type="checkbox"
          :checked="item.enabled"
          class="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          @change="toggleRow(index)"
        />
      </div>

      <!-- Key -->
      <div class="border-l border-border h-full flex items-center" :class="{ 'opacity-50': !item.enabled }">
        <BaseEnvInput
          :model-value="item.key"
          :placeholder="keyPlaceholder || 'Key'"
          :disabled="readonly"
          monospace
          size="sm"
          @update:model-value="updateRow(index, 'key', $event)"
        />
      </div>

      <!-- Value -->
      <div class="border-l border-border h-full flex items-center" :class="{ 'opacity-50': !item.enabled }">
        <BaseEnvInput
          :model-value="item.value"
          :placeholder="valuePlaceholder || 'Value'"
          :disabled="readonly"
          monospace
          size="sm"
          @update:model-value="updateRow(index, 'value', $event)"
        />
      </div>

      <!-- Delete -->
      <div class="flex justify-center h-full items-center border-l border-border">
        <button
          v-if="!readonly && rows.length > 1"
          class="text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
          @click="removeRow(index)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
