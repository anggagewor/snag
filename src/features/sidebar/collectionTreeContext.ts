import type { Ref } from 'vue'
import type { UUID } from '@/types/common'

export interface DragState {
  draggingId: Ref<UUID | null>
  dragOverId: Ref<UUID | null>
  dragPosition: Ref<'before' | 'after' | 'inside' | null>
}

export interface TreeContext {
  expandedIds: Ref<Set<UUID>>
  editingId: Ref<UUID | null>
  editingName: Ref<string>
  startRename: (id: UUID, name: string) => void
  finishRenameItem: (collectionId: UUID, itemId: UUID) => void
  cancelRename: () => void
  drag: DragState
}
