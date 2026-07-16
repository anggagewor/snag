<script setup lang="ts">
import { ref, computed } from 'vue'

import { X } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePairEditable } from '@/domain'
import { STANDARD_HEADERS, HEADER_VALUE_SUGGESTIONS } from '@/utils/http-headers'
import BaseComboInput from '@/components/base/BaseComboInput.vue'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const viewMode = ref<'table' | 'bulk'>('table')

const headers = computed(() => {
  const items = props.tab.requestDraft?.headers || []
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }]
  }
  return items
})

const bulkText = computed(() => {
  return headers.value
    .filter((h) => h.key || h.value)
    .map((h) => `${h.key}:${h.value}`)
    .join('\n')
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

function sync(updated: KeyValuePairEditable[]) {
  const cleaned = updated.filter((item, i) => {
    if (i === updated.length - 1) return true
    return item.key !== '' || item.value !== ''
  })
  if (props.tab.requestDraft) {
    props.tab.requestDraft.headers = cleaned
    tabsStore.recomputeDirty(props.tab.id)
  }
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

function onBulkChange(e: Event) {
  const text = (e.target as HTMLTextAreaElement).value
  const pairs: KeyValuePairEditable[] = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const colonIdx = line.indexOf(':')
      const key = colonIdx > -1 ? line.slice(0, colonIdx).trim() : line.trim()
      const value = colonIdx > -1 ? line.slice(colonIdx + 1).trim() : ''
      return {
        id: crypto.randomUUID(),
        key,
        value,
        enabled: true,
      }
    })
  if (props.tab.requestDraft) {
    props.tab.requestDraft.headers = pairs
    tabsStore.recomputeDirty(props.tab.id)
  }
}
</script>

<template>
  <div>
    <!-- Toggle -->
    <div class="flex items-center justify-end px-3 py-1.5 border-b border-border">
      <div class="flex rounded border border-border overflow-hidden">
        <button
          class="px-2 py-0.5 text-[10px] font-medium transition-colors"
          :class="viewMode === 'table' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-primary'"
          @click="viewMode = 'table'"
        >
          Table
        </button>
        <button
          class="px-2 py-0.5 text-[10px] font-medium border-l border-border transition-colors"
          :class="viewMode === 'bulk' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-primary'"
          @click="viewMode = 'bulk'"
        >
          Bulk Edit
        </button>
      </div>
    </div>

    <!-- Table view -->
    <div v-if="viewMode === 'table'">
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
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk edit view -->
    <div v-else class="p-3">
      <textarea
        :value="bulkText"
        class="w-full h-48 text-xs font-mono bg-surface border border-border rounded p-2 text-primary placeholder:text-muted resize-y focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="key:value (one per line)"
        @input="onBulkChange"
      />
      <p class="mt-1 text-[10px] text-muted">One header per line, format: key:value</p>
    </div>
  </div>
</template>
