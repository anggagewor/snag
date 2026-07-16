<script setup lang="ts">
import { ref, computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePairEditable } from '@/domain'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const viewMode = ref<'table' | 'bulk'>('table')

const params = computed(() => props.tab.requestDraft?.params || [])

const bulkText = computed(() => {
  return params.value
    .filter((p) => p.key || p.value)
    .map((p) => `${p.key}:${p.value}`)
    .join('\n')
})

function updateParams(value: KeyValuePairEditable[]) {
  if (props.tab.requestDraft) {
    props.tab.requestDraft.params = value
    tabsStore.recomputeDirty(props.tab.id)
  }
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
    props.tab.requestDraft.params = pairs
    tabsStore.recomputeDirty(props.tab.id)
  }
}
</script>

<template>
  <div>
    <!-- Query Params header + toggle -->
    <div class="flex items-center justify-between px-1 pb-2">
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
