<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

import { Search } from 'lucide-vue-next'

import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import type { TreeNode, RequestId } from '@/domain'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface SearchResult {
  requestId: string
  collectionId: string
  collectionName: string
  name: string
  method: string
  url: string
  path: string
}

// Cache for search — preloaded request metadata
const searchIndex = ref<SearchResult[]>([])

async function buildSearchIndex() {
  const results: SearchResult[] = []

  for (const col of workspaceStore.collections) {
    await indexTreeNodes(col.items, col.id, col.name, '', results)
  }

  searchIndex.value = results
}

async function indexTreeNodes(
  nodes: readonly TreeNode[],
  collectionId: string,
  collectionName: string,
  parentPath: string,
  results: SearchResult[],
) {
  for (const node of nodes) {
    if (node.type === 'request') {
      try {
        const req = await workspaceStore.getRequest(node.requestId as RequestId)
        results.push({
          requestId: node.requestId,
          collectionId,
          collectionName,
          name: req.name,
          method: req.method,
          url: req.url,
          path: parentPath ? `${parentPath} / ${req.name}` : req.name,
        })
      } catch {
        // Skip unavailable requests
      }
    } else if (node.type === 'folder') {
      const currentPath = parentPath ? `${parentPath} / ${node.name}` : node.name
      await indexTreeNodes(node.children, collectionId, collectionName, currentPath, results)
    }
  }
}

const results = computed<SearchResult[]>(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) {
    return searchIndex.value.slice(0, 20)
  }
  return searchIndex.value.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.collectionName.toLowerCase().includes(q) ||
    r.url.toLowerCase().includes(q) ||
    r.method.toLowerCase().includes(q)
  ).slice(0, 20)
})

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    selectedIndex.value = 0
    buildSearchIndex()
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, () => {
  selectedIndex.value = 0
})

async function selectResult(result: SearchResult) {
  try {
    const request = await workspaceStore.getRequest(result.requestId as RequestId)
    const sourceId = `${result.collectionId}:${result.requestId}`
    tabsStore.openRequestTab(result.requestId as RequestId, sourceId, request.name)
  } catch (err) {
    console.error('[SearchPalette] Failed to open request:', err)
  }
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      if (results.value[selectedIndex.value]) {
        selectResult(results.value[selectedIndex.value])
      }
      break
    case 'Escape':
      e.preventDefault()
      emit('close')
      break
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      @mousedown.self="emit('close')"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

      <!-- Palette -->
      <div
        class="relative w-full max-w-[520px] bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
        @keydown="handleKeydown"
      >
        <!-- Search input -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search class="w-4 h-4 text-muted flex-shrink-0" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="flex-1 bg-transparent text-sm text-primary placeholder:text-muted focus:outline-none"
            placeholder="Search requests..."
          />
          <kbd class="text-[10px] text-muted bg-surface-alt border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <!-- Results -->
        <div class="max-h-[320px] overflow-y-auto">
          <div v-if="results.length === 0" class="px-4 py-8 text-center text-sm text-muted">
            No requests found
          </div>
          <button
            v-for="(result, i) in results"
            :key="result.requestId"
            class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
            :class="i === selectedIndex ? 'bg-accent/10 text-primary' : 'text-primary hover:bg-surface-hover'"
            @click="selectResult(result)"
            @mouseenter="selectedIndex = i"
          >
            <BaseBadge :method="result.method as any" />
            <div class="flex-1 min-w-0">
              <div class="truncate font-medium text-xs">{{ result.name }}</div>
              <div class="truncate text-[10px] text-muted">
                {{ result.collectionName }} / {{ result.path }}
              </div>
            </div>
            <span v-if="result.url" class="text-[10px] text-muted truncate max-w-[140px]">
              {{ result.url }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
