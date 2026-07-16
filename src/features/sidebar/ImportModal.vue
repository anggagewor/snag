<script setup lang="ts">
import { ref } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { importPostmanCollection } from '@/utils/import-postman'
import { importOpenApiSpec } from '@/utils/import-openapi'
import { importPostmanEnvironment, isPostmanEnvironment } from '@/utils/import-environment'
import * as yaml from 'js-yaml'
import BaseModal from '@/components/base/BaseModal.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const workspaceStore = useWorkspaceStore()

const importType = ref<'postman' | 'openapi' | 'environment'>('postman')
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
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.yaml,.yml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) {
        const text = await file.text()
        importText.value = text
        autoDetectType()
      }
    }
    input.click()
    return
  }

  if (filePath && isTauri) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const content = await readTextFile(filePath)
    importText.value = content
    autoDetectType()
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

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      try {
        json = yaml.load(text)
      } catch (yamlErr) {
        throw new Error(`Failed to parse as JSON or YAML: ${yamlErr instanceof Error ? yamlErr.message : 'Invalid format'}`)
      }
    }

    if (importType.value === 'environment') {
      const env = importPostmanEnvironment(json)
      const created = await workspaceStore.createEnvironment(env.name)
      // Save with imported variables
      const updated = { ...created, variables: env.variables.map((v: any) => ({ key: v.key, value: v.value, enabled: v.enabled ?? true })) }
      await workspaceStore.saveEnvironment(updated)
      importSuccess.value = `Imported environment "${env.name}" with ${env.variables.length} variables`
    } else {
      let collection
      if (importType.value === 'postman') {
        collection = importPostmanCollection(json)
      } else {
        collection = importOpenApiSpec(json)
      }

      // Create collection in workspace and import items
      const created = await workspaceStore.createCollection(collection.name)

      // Write each request as individual file and build tree
      const { ulid } = await import('@/domain')
      type TreeNode = import('@/domain').TreeNode
      type FolderId = import('@/domain').FolderId

      async function importItems(items: any[]): Promise<TreeNode[]> {
        const nodes: TreeNode[] = []
        for (const item of items) {
          if (item.type === 'folder') {
            const folderId = ulid() as FolderId
            const children = item.items ? await importItems(item.items) : []
            nodes.push({ type: 'folder', id: folderId, name: item.name, children })
          } else if (item.type === 'request' && item.request) {
            const req = await workspaceStore.createRequest(created.id as any, null, {
              name: item.name,
              method: item.request.method || 'GET',
            })
            // Save full request data
            const updated = {
              ...req,
              url: item.request.url || '',
              headers: (item.request.headers || []).map((h: any) => ({ key: h.key, value: h.value, enabled: h.enabled ?? true })),
              params: (item.request.params || []).map((p: any) => ({ key: p.key, value: p.value, enabled: p.enabled ?? true })),
              body: {
                type: (item.request.body?.type || 'none') as any,
                content: item.request.body?.content || '',
                ...(item.request.body?.formData && { formData: item.request.body.formData.map((f: any) => ({ key: f.key, value: f.value, enabled: f.enabled ?? true })) }),
                ...(item.request.body?.binaryPath && { binaryPath: item.request.body.binaryPath }),
              },
              auth: item.request.auth || { type: 'none' as const },
              preRequest: item.request.preRequest || '',
              tests: item.request.tests || '',
            }
            await workspaceStore.saveRequest(updated)
          }
        }
        return nodes
      }

      await importItems(collection.items)
      await workspaceStore.reloadCollection(created.id as any)
      importSuccess.value = `Imported "${collection.name}" with ${countRequests(collection.items)} requests`
    }

    importText.value = ''
    handleClose()
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

    if (isPostmanEnvironment(parsed)) {
      importType.value = 'environment'
    } else if (parsed.openapi || parsed.swagger) {
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
  <BaseModal :open="open" title="Import" max-width="max-w-lg" @close="handleClose">
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
            <p class="text-[10px] mt-0.5 opacity-70">3.x / Swagger 2.x</p>
          </button>
          <button
            class="flex-1 px-3 py-2 text-xs rounded border transition-colors text-left"
            :class="importType === 'environment'
              ? 'border-accent bg-accent/5 text-accent'
              : 'border-border text-primary hover:bg-surface-hover'"
            @click="importType = 'environment'"
          >
            <span class="font-medium">Environment</span>
            <p class="text-[10px] mt-0.5 opacity-70">Postman env export</p>
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
          placeholder="Paste your Postman Collection, OpenAPI spec, or Postman Environment JSON here..."
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
        Cancel
      </button>
      <button
        class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        :disabled="!importText.trim() || isImporting"
        @click="handleImport"
      >
        {{ isImporting ? 'Importing...' : 'Import' }}
      </button>
    </template>
  </BaseModal>
</template>
