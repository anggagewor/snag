import type { Ref } from 'vue'
import type { UUID } from '@/types/common'

export interface TreeContext {
  expandedIds: Ref<Set<UUID>>
  editingId: Ref<UUID | null>
  editingName: Ref<string>
  startRename: (id: UUID, name: string) => void
  finishRenameItem: (collectionId: UUID, itemId: UUID) => void
  cancelRename: () => void
}
