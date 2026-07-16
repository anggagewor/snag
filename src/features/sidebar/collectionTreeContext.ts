import type { Ref } from 'vue'

export interface DragState {
  draggingId: Ref<string | null>
  dragOverId: Ref<string | null>
  dragPosition: Ref<'before' | 'after' | 'inside' | null>
}

export interface TreeContext {
  expandedIds: Ref<Set<string>>
  editingId: Ref<string | null>
  editingName: Ref<string>
  /** Cached request names for display in tree (requestId → name) */
  requestNames: Ref<Map<string, string>>
  /** Cached request methods for badge display (requestId → method) */
  requestMethods: Ref<Map<string, string>>
  startRename: (id: string, name: string) => void
  finishRenameItem: (collectionId: string, itemId: string) => void
  cancelRename: () => void
  drag: DragState
}
