<script setup lang="ts">
import { computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePair } from '@/types/common'
import { STANDARD_HEADERS, HEADER_VALUE_SUGGESTIONS } from '@/utils/http-headers'
import BaseComboInput from '@/components/base/BaseComboInput.vue'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const headers = computed(() => {
  const items = props.tab.request?.headers || []
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }]
  }
  return items
})

function getValueSuggestions(key: string): string[] {
  if (!key) return []
  const exact = HEADER_VALUE_SUGGESTIONS[key]
  if (exact) return exact
  const found = Object.entries(HEADER_VALUE_SUGGESTIONS).find(
    ([k]) => k.toLowerCase() === key.toLowerCase()
  )
  return found ? found[1] : []
}

function sync(updated: KeyValuePair[]) {
  const cleaned = updated.filter((item, i) => {
    if (i === updated.length - 1) return true
    return item.key !== '' || item.value !== ''
  })
  tabsStore.updateTabRequest(props.tab.id, { headers: cleaned })
}

function updateKey(index: number, value: string) {
  const updated = [...headers.value]
  updated[index] = { ...updated[index], key: value }
  if (index === updated.length - 1 && value !== '') {
    updated.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true })
  }
  sync(updated)
}

function updateValue(index: number, value: string) {
  const updated = [...headers.value]
  updated[index] = { ...updated[index], value }
  if (index === updated.length - 1 && value !== '') {
    updated.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true })
  }
  sync(updated)
}

function toggleRow(index: number) {
  const updated = [...headers.value]
  updated[index] = { ...updated[index], enabled: !updated[index].enabled }
  sync(updated)
}

function removeRow(index: number) {
  const updated = headers.value.filter((_, i) => i !== index)
  sync(updated.length === 0 ? [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }] : updated)
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
      v-for="(item, index) in headers"
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

      <!-- Key (with standard header suggestions) -->
      <div class="border-l border-border h-full" :class="{ 'opacity-50': !item.enabled }">
        <BaseComboInput
          :model-value="item.key"
          :suggestions="STANDARD_HEADERS"
          placeholder="Header name"
          monospace
          @update:model-value="updateKey(index, $event)"
        />
      </div>

      <!-- Value (with env var support + header value suggestions) -->
      <div class="border-l border-border h-full flex items-center" :class="{ 'opacity-50': !item.enabled }">
        <!-- If the header has known value suggestions, use ComboInput. Otherwise use EnvInput -->
        <BaseComboInput
          v-if="getValueSuggestions(item.key).length > 0"
          :model-value="item.value"
          :suggestions="getValueSuggestions(item.key)"
          placeholder="Header value"
          monospace
          @update:model-value="updateValue(index, $event)"
        />
        <BaseEnvInput
          v-else
          :model-value="item.value"
          placeholder="Header value or {{variable}}"
          monospace
          size="sm"
          @update:model-value="updateValue(index, $event)"
        />
      </div>

      <!-- Delete -->
      <div class="flex justify-center h-full items-center border-l border-border">
        <button
          v-if="headers.length > 1"
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
