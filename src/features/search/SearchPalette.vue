<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

import { Search } from 'lucide-vue-next'

import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import type { CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const collectionsStore = useCollectionsStore()
const tabsStore = useTabsStore()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface SearchResult {
  id: UUID
  collectionId: UUID
  collectionName: string
  name: string
  item: CollectionItem
  path: string
}

const results = computed<SearchResult[]>(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) {
    return getAllRequests().slice(0, 20)
  }
  return getAllRequests().filter((r) =>
    r.name.toLowerCase().includes(q) ||
    r.collectionName.toLowerCase().includes(q) ||
    r.item.request?.url.toLowerCase().includes(q) ||
    r.item.request?.method.toLowerCase().includes(q)
  ).slice(0, 20)
})

function getAllRequests(): SearchResult[] {
  const items: SearchResult[] = []
  for (const col of collectionsStore.collections) {
    flattenItems(col.items, col.id, col.name, '')
      .forEach((r) => items.push(r))
  }
  return items
}

function flattenItems(
  items: CollectionItem[],
  collectionId: UUID,
  collectionName: string,
  parentPath: string
): SearchResult[] {
  const results: SearchResult[] = []
  for (const item of items) {
    const currentPath = parentPath ? `${parentPath} / ${item.name}` : item.name
    if (item.type === 'request') {
      results.push({
        id: item.id,
        collectionId,
        collectionName,
        name: item.name,
        item,
        path: currentPath,
      })
    }
    if (item.items) {
      results.push(...flattenItems(item.items, collectionId, collectionName, currentPath))
    }
  }
  return results
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, () => {
  selectedIndex.value = 0
})

function selectResult(result: SearchResult) {
  const sourceId = `${result.collectionId}:${result.id}`
  if (result.item.request) {
    tabsStore.openRequestTab(
      JSON.parse(JSON.stringify(result.item.request)),
      result.name,
      sourceId
    )
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
            :key="result.id"
            class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
            :class="i === selectedIndex ? 'bg-accent/10 text-primary' : 'text-primary hover:bg-surface-hover'"
            @click="selectResult(result)"
            @mouseenter="selectedIndex = i"
          >
            <BaseBadge v-if="result.item.request" :method="result.item.request.method" />
            <div class="flex-1 min-w-0">
              <div class="truncate font-medium text-xs">{{ result.name }}</div>
              <div class="truncate text-[10px] text-muted">
                {{ result.collectionName }} / {{ result.path }}
              </div>
            </div>
            <span v-if="result.item.request?.url" class="text-[10px] text-muted truncate max-w-[140px]">
              {{ result.item.request.url }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
