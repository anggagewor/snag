<script setup lang="ts">
import { computed } from 'vue'

import { CloudUpload, CheckCircle } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const filePath = computed(() => props.tab.requestDraft?.body.binaryPath || '')
const fileName = computed(() => {
  const path = filePath.value
  if (!path) return ''
  return path.split('/').pop() || path
})

async function pickFile() {
  let selectedPath: string | null = null

  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({ multiple: false, title: 'Select File' })
    selectedPath = result as string | null
  } else {
    selectedPath = prompt('Enter file path (Tauri not available in browser mode):')
  }

  if (selectedPath && props.tab.requestDraft) {
    props.tab.requestDraft.body.binaryPath = selectedPath
    tabsStore.recomputeDirty(props.tab.id)
  }
}

function clearFile() {
  if (props.tab.requestDraft) {
    props.tab.requestDraft.body.binaryPath = undefined
    tabsStore.recomputeDirty(props.tab.id)
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full">
    <div v-if="!filePath" class="text-center">
      <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-surface-alt border-2 border-dashed border-border flex items-center justify-center">
        <CloudUpload class="w-7 h-7 text-muted" :stroke-width="1.5" />
      </div>
      <p class="text-sm text-primary mb-1">Select a file to upload</p>
      <p class="text-xs text-muted mb-3">The file will be sent as raw binary in the request body</p>
      <button
        class="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        @click="pickFile"
      >
        Choose File
      </button>
    </div>

    <div v-else class="text-center">
      <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-success/10 flex items-center justify-center">
        <CheckCircle class="w-7 h-7 text-success" :stroke-width="1.5" />
      </div>
      <p class="text-sm font-medium text-primary mb-0.5">{{ fileName }}</p>
      <p class="text-xs text-muted font-mono mb-3 max-w-[400px] truncate">{{ filePath }}</p>
      <div class="flex items-center gap-2 justify-center">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-secondary hover:text-primary hover:border-secondary transition-colors"
          @click="pickFile"
        >
          Change File
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md text-error hover:bg-error/10 transition-colors"
          @click="clearFile"
        >
          Remove
        </button>
      </div>
    </div>
  </div>
</template>
