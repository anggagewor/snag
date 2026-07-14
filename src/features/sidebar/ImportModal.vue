<script setup lang="ts">
import { ref } from 'vue'

import { useCollectionsStore } from '@/stores/collections'
import { importPostmanCollection } from '@/utils/import-postman'
import { importOpenApiSpec } from '@/utils/import-openapi'
import * as yaml from 'js-yaml'
import BaseModal from '@/components/base/BaseModal.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const collectionsStore = useCollectionsStore()

const importType = ref<'postman' | 'openapi'>('postman')
const importText = ref('')
const importError = ref<string | null>(null)
const importSuccess = ref<string | null>(null)
const isImporting = ref(false)

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function pickFile() {
  let filePath: string | null = null

  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({
      multiple: false,
      title: 'Import File',
      filters: [{ name: 'JSON', extensions: ['json', 'yaml', 'yml'] }],
    })
    filePath = result as string | null
  } else {
    // Browser fallback: file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.yaml,.yml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) {
        const text = await file.text()
        importText.value = text
      }
    }
    input.click()
    return
  }

  if (filePath && isTauri) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const content = await readTextFile(filePath)
    importText.value = content
  }
}

async function handleImport() {
  importError.value = null
  importSuccess.value = null
  isImporting.value = true

  try {
    const text = importText.value.trim()
    if (!text) {
      importError.value = 'Please paste or load a file first'
      return
    }

    // Parse as JSON first, fall back to YAML
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      // Try YAML
      try {
        json = yaml.load(text)
      } catch (yamlErr) {
        throw new Error(`Failed to parse as JSON or YAML: ${yamlErr instanceof Error ? yamlErr.message : 'Invalid format'}`)
      }
    }

    let collection

    if (importType.value === 'postman') {
      collection = importPostmanCollection(json)
    } else {
      collection = importOpenApiSpec(json)
    }

    // Add to collections store
    collectionsStore.collections.push(collection)
    collectionsStore.save()

    importSuccess.value = `Imported "${collection.name}" with ${countRequests(collection.items)} requests`
    importText.value = ''
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to parse file'
    console.error('[Import]', err)
  } finally {
    isImporting.value = false
  }
}

function countRequests(items: { type: string; items?: unknown[] }[]): number {
  let count = 0
  for (const item of items) {
    if (item.type === 'request') count++
    if (item.items) count += countRequests(item.items as { type: string; items?: unknown[] }[])
  }
  return count
}

function handleClose() {
  importError.value = null
  importSuccess.value = null
  importText.value = ''
  emit('close')
}

function autoDetectType() {
  const text = importText.value.trim()
  if (!text) return
  try {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = yaml.load(text) as Record<string, unknown>
    }
    if (parsed.openapi || parsed.swagger) {
      importType.value = 'openapi'
    } else if (
      (parsed.info as Record<string, unknown>)?.schema?.toString().includes('postman') ||
      (parsed.info as Record<string, unknown>)?._postman_id ||
      parsed.item
    ) {
      importType.value = 'postman'
    }
  } catch {
    // ignore parse errors during typing
  }
}
</script>

<template>
  <BaseModal :open="open" title="Import Collection" max-width="max-w-lg" @close="handleClose">
    <div class="space-y-4">
      <!-- Import type -->
      <div class="space-y-1.5">
        <label class="block text-xs text-secondary">Format</label>
        <div class="flex gap-2">
          <button
            class="flex-1 px-3 py-2 text-xs rounded border transition-colors text-left"
            :class="importType === 'postman'
              ? 'border-accent bg-accent/5 text-accent'
              : 'border-border text-primary hover:bg-surface-hover'"
            @click="importType = 'postman'"
          >
            <span class="font-medium">Postman Collection</span>
            <p class="text-[10px] mt-0.5 opacity-70">v2.1 JSON format</p>
          </button>
          <button
            class="flex-1 px-3 py-2 text-xs rounded border transition-colors text-left"
            :class="importType === 'openapi'
              ? 'border-accent bg-accent/5 text-accent'
              : 'border-border text-primary hover:bg-surface-hover'"
            @click="importType = 'openapi'"
          >
            <span class="font-medium">OpenAPI Spec</span>
            <p class="text-[10px] mt-0.5 opacity-70">OpenAPI 3.x / Swagger 2.x (JSON or YAML)</p>
          </button>
        </div>
      </div>

      <!-- File picker or paste -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="block text-xs text-secondary">Content</label>
          <button
            class="text-[10px] text-accent hover:text-accent-hover"
            @click="pickFile"
          >
            Browse file...
          </button>
        </div>
        <textarea
          v-model="importText"
          class="w-full h-[200px] rounded-md border border-border bg-surface text-primary font-mono text-xs p-3 resize-none focus:outline-none focus:border-accent"
          placeholder="Paste your Postman Collection or OpenAPI spec JSON here..."
          @input="autoDetectType"
        />
      </div>

      <!-- Error / Success -->
      <div v-if="importError" class="px-3 py-2 bg-error/10 text-error text-xs rounded">
        {{ importError }}
      </div>
      <div v-if="importSuccess" class="px-3 py-2 bg-success/10 text-success text-xs rounded">
        {{ importSuccess }}
      </div>
    </div>

    <template #footer>
      <button
        class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary"
        @click="handleClose"
      >
        {{ importSuccess ? 'Done' : 'Cancel' }}
      </button>
      <button
        v-if="!importSuccess"
        class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        :disabled="!importText.trim() || isImporting"
        @click="handleImport"
      >
        {{ isImporting ? 'Importing...' : 'Import' }}
      </button>
    </template>
  </BaseModal>
</template>
