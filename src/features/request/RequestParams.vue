<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePair } from '@/types/common'
import type { PathParam } from '@/types/request'
import { extractPathParams } from '@/types/request'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const viewMode = ref<'table' | 'bulk'>('table')

const params = computed(() => props.tab.request?.params || [])

// Reactive path params extracted from URL
const detectedPathParams = computed(() => {
  const url = props.tab.request?.url || ''
  return extractPathParams(url)
})

const pathParams = computed(() => props.tab.request?.pathParams || [])

// Sync path params when URL changes — add new ones, keep existing values
watch(detectedPathParams, (detected) => {
  const existing = props.tab.request?.pathParams || []
  const updated: PathParam[] = detected.map((key) => {
    const found = existing.find((p) => p.key === key)
    return { key, value: found?.value || '' }
  })
  tabsStore.updateTabRequest(props.tab.id, { pathParams: updated })
}, { immediate: true })

function updatePathParamValue(key: string, value: string) {
  const updated = (props.tab.request?.pathParams || []).map((p) =>
    p.key === key ? { ...p, value } : p
  )
  tabsStore.updateTabRequest(props.tab.id, { pathParams: updated })
}

const bulkText = computed(() => {
  return params.value
    .filter((p) => p.key || p.value)
    .map((p) => `${p.key}:${p.value}`)
    .join('\n')
})

function updateParams(value: KeyValuePair[]) {
  tabsStore.updateTabRequest(props.tab.id, { params: value })
}

function onBulkChange(e: Event) {
  const text = (e.target as HTMLTextAreaElement).value
  const pairs: KeyValuePair[] = text
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
  tabsStore.updateTabRequest(props.tab.id, { params: pairs })
}
</script>

<template>
  <div>
    <!-- Path Variables section (only shown when URL has :params) -->
    <div v-if="detectedPathParams.length > 0" class="mb-4">
      <div class="flex items-center gap-2 px-1 pb-2">
        <span class="text-xs font-medium text-muted uppercase tracking-wide">Path Variables</span>
        <span class="text-[10px] text-muted">(from URL)</span>
      </div>

      <!-- Path params table -->
      <div class="border border-border rounded overflow-hidden">
        <div class="grid grid-cols-[1fr_1fr] gap-0 text-xs text-muted border-b border-border">
          <span class="px-2 py-1.5">Key</span>
          <span class="px-2 py-1.5 border-l border-border">Value</span>
        </div>
        <div
          v-for="param in pathParams"
          :key="param.key"
          class="grid grid-cols-[1fr_1fr] gap-0 items-center border-b border-border last:border-b-0"
        >
          <div class="px-2 py-1.5">
            <span class="text-xs font-mono text-accent">:{{ param.key }}</span>
          </div>
          <div class="border-l border-border h-full flex items-center">
            <BaseEnvInput
              :model-value="param.value"
              :placeholder="`Enter ${param.key}`"
              monospace
              size="sm"
              @update:model-value="updatePathParamValue(param.key, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Query Params header + toggle -->
    <div class="flex items-center justify-between px-1 pb-2">
      <span v-if="detectedPathParams.length > 0" class="text-xs font-medium text-muted uppercase tracking-wide">Query Parameters</span>
      <div class="flex rounded border border-border overflow-hidden ml-auto">
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
    <BaseKeyValueEditor
      v-if="viewMode === 'table'"
      :model-value="params"
      key-placeholder="Parameter name"
      value-placeholder="Parameter value"
      @update:model-value="updateParams"
    />

    <!-- Bulk edit view -->
    <div v-else class="p-3">
      <textarea
        :value="bulkText"
        class="w-full h-48 text-xs font-mono bg-surface border border-border rounded p-2 text-primary placeholder:text-muted resize-y focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="key:value (one per line)"
        @input="onBulkChange"
      />
      <p class="mt-1 text-[10px] text-muted">One parameter per line, format: key:value</p>
    </div>
  </div>
</template>
