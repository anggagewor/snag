<script setup lang="ts">
import { computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { FormDataField } from '@/types/request'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const fields = computed(() => {
  const items = props.tab.request?.body.formData || []
  if (items.length === 0) {
    return [createEmptyField()]
  }
  return items
})

function createEmptyField(): FormDataField {
  return {
    id: crypto.randomUUID(),
    key: '',
    value: '',
    enabled: true,
    fieldType: 'text',
  }
}

function sync(updated: FormDataField[]) {
  const cleaned = updated.filter((item, i) => {
    if (i === updated.length - 1) return true
    return item.key !== '' || item.value !== ''
  })
  tabsStore.updateTabRequest(props.tab.id, {
    body: { ...props.tab.request!.body, formData: cleaned },
  })
}

function updateKey(index: number, value: string) {
  const updated = [...fields.value]
  updated[index] = { ...updated[index], key: value }
  if (index === updated.length - 1 && value !== '') {
    updated.push(createEmptyField())
  }
  sync(updated)
}

function updateValue(index: number, value: string) {
  const updated = [...fields.value]
  updated[index] = { ...updated[index], value }
  if (index === updated.length - 1 && value !== '') {
    updated.push(createEmptyField())
  }
  sync(updated)
}

function toggleFieldType(index: number) {
  const updated = [...fields.value]
  const current = updated[index]
  updated[index] = {
    ...current,
    fieldType: current.fieldType === 'text' ? 'file' : 'text',
    value: '',
    fileName: undefined,
  }
  sync(updated)
}

function toggleRow(index: number) {
  const updated = [...fields.value]
  updated[index] = { ...updated[index], enabled: !updated[index].enabled }
  sync(updated)
}

function removeRow(index: number) {
  const updated = fields.value.filter((_, i) => i !== index)
  sync(updated.length === 0 ? [createEmptyField()] : updated)
}

async function pickFile(index: number) {
  let filePath: string | null = null

  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({ multiple: false, title: 'Select File' })
    filePath = result as string | null
  } else {
    // Browser fallback: prompt for path
    filePath = prompt('Enter file path (Tauri not available in browser mode):')
  }

  if (filePath) {
    const fileName = filePath.split('/').pop() || filePath
    const updated = [...fields.value]
    updated[index] = { ...updated[index], value: filePath, fileName }
    if (index === updated.length - 1) {
      updated.push(createEmptyField())
    }
    sync(updated)
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="grid grid-cols-[32px_60px_1fr_1fr_32px] gap-0 text-xs text-muted border-b border-border">
      <span class="px-1 py-1.5"></span>
      <span class="px-2 py-1.5 border-l border-border">Type</span>
      <span class="px-2 py-1.5 border-l border-border">Key</span>
      <span class="px-2 py-1.5 border-l border-border">Value</span>
      <span class="px-1 py-1.5 border-l border-border"></span>
    </div>

    <!-- Rows -->
    <div
      v-for="(item, index) in fields"
      :key="item.id"
      class="grid grid-cols-[32px_60px_1fr_1fr_32px] gap-0 items-center group border-b border-border"
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

      <!-- Field type toggle -->
      <div class="border-l border-border h-full flex items-center justify-center">
        <button
          class="px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors"
          :class="item.fieldType === 'file'
            ? 'bg-accent/10 text-accent'
            : 'text-muted hover:text-primary'"
          @click="toggleFieldType(index)"
        >
          {{ item.fieldType === 'file' ? 'File' : 'Text' }}
        </button>
      </div>

      <!-- Key -->
      <div class="border-l border-border h-full flex items-center" :class="{ 'opacity-50': !item.enabled }">
        <BaseEnvInput
          :model-value="item.key"
          placeholder="Field name or {{variable}}"
          monospace
          size="sm"
          @update:model-value="updateKey(index, $event)"
        />
      </div>

      <!-- Value -->
      <div class="border-l border-border h-full flex items-center" :class="{ 'opacity-50': !item.enabled }">
        <!-- Text input with env var support -->
        <BaseEnvInput
          v-if="item.fieldType === 'text'"
          :model-value="item.value"
          placeholder="Field value or {{variable}}"
          monospace
          size="sm"
          @update:model-value="updateValue(index, $event)"
        />
        <!-- File picker -->
        <div v-else class="flex items-center gap-1.5 px-2 w-full">
          <button
            class="flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-border text-secondary hover:text-primary hover:border-secondary transition-colors"
            @click="pickFile(index)"
          >
            Choose File
          </button>
          <span v-if="item.fileName" class="text-xs text-primary truncate font-mono">{{ item.fileName }}</span>
          <span v-else class="text-xs text-muted">No file selected</span>
        </div>
      </div>

      <!-- Delete -->
      <div class="flex justify-center h-full items-center border-l border-border">
        <button
          v-if="fields.length > 1"
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
