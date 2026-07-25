import { ref, computed, watch } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { RequestDraft } from '@/domain'

const MAX_HISTORY = 50
const DEBOUNCE_MS = 500

interface UndoStack {
  past: string[]
  future: string[]
  /** Debounce timer for grouping rapid edits into one snapshot */
  timer: ReturnType<typeof setTimeout> | null
  /** The last snapshot we pushed (to avoid duplicates) */
  lastPushed: string | null
}

/** Per-tab undo stacks, keyed by tab ID */
const stacks = new Map<string, UndoStack>()

function getStack(tabId: string): UndoStack {
  if (!stacks.has(tabId)) {
    stacks.set(tabId, { past: [], future: [], timer: null, lastPushed: null })
  }
  return stacks.get(tabId)!
}

function serializeDraft(draft: RequestDraft): string {
  return JSON.stringify(draft)
}

function deserializeDraft(data: string): RequestDraft {
  return JSON.parse(data)
}

/**
 * Push a snapshot to the undo stack for a given tab.
 * Called before the draft changes so we can restore the previous state.
 */
function pushSnapshot(tabId: string, draft: RequestDraft): void {
  const stack = getStack(tabId)
  const serialized = serializeDraft(draft)

  // Don't push if identical to last pushed snapshot
  if (stack.lastPushed === serialized) return

  stack.past.push(serialized)
  if (stack.past.length > MAX_HISTORY) {
    stack.past.shift()
  }
  // Any new edit clears redo
  stack.future = []
  stack.lastPushed = serialized
}

/**
 * Schedule a snapshot push with debouncing.
 * This groups rapid keystrokes into a single undo entry.
 */
function scheduleSnapshot(tabId: string, draft: RequestDraft): void {
  const stack = getStack(tabId)

  // If first change after init/undo/redo, push immediately
  if (stack.past.length === 0 && stack.lastPushed === null) {
    pushSnapshot(tabId, draft)
    return
  }

  if (stack.timer) {
    clearTimeout(stack.timer)
  }

  stack.timer = setTimeout(() => {
    pushSnapshot(tabId, draft)
    stack.timer = null
  }, DEBOUNCE_MS)
}

export function useUndoRedo() {
  const tabsStore = useTabsStore()

  const canUndo = computed(() => {
    const tab = tabsStore.activeTab
    if (!tab || tab.type !== 'request') return false
    const stack = stacks.get(tab.id)
    return !!stack && stack.past.length > 0
  })

  const canRedo = computed(() => {
    const tab = tabsStore.activeTab
    if (!tab || tab.type !== 'request') return false
    const stack = stacks.get(tab.id)
    return !!stack && stack.future.length > 0
  })

  /**
   * Record the current draft state before it changes.
   * Components call this when they mutate the draft.
   */
  function recordChange(tabId: string, draftBeforeChange: RequestDraft): void {
    scheduleSnapshot(tabId, draftBeforeChange)
  }

  /**
   * Undo: restore the most recent past snapshot.
   */
  function undo(): boolean {
    const tab = tabsStore.activeTab
    if (!tab || tab.type !== 'request' || !tab.requestDraft) return false

    const stack = getStack(tab.id)
    if (stack.past.length === 0) return false

    // Flush any pending debounced snapshot
    if (stack.timer) {
      clearTimeout(stack.timer)
      stack.timer = null
    }

    // Save current state to future (redo)
    stack.future.push(serializeDraft(tab.requestDraft))

    // Pop from past
    const previous = stack.past.pop()!
    const restored = deserializeDraft(previous)

    // Apply restored draft
    applyDraft(tab.id, restored)
    stack.lastPushed = previous

    return true
  }

  /**
   * Redo: restore the most recent future snapshot.
   */
  function redo(): boolean {
    const tab = tabsStore.activeTab
    if (!tab || tab.type !== 'request' || !tab.requestDraft) return false

    const stack = getStack(tab.id)
    if (stack.future.length === 0) return false

    // Save current state to past
    stack.past.push(serializeDraft(tab.requestDraft))

    // Pop from future
    const next = stack.future.pop()!
    const restored = deserializeDraft(next)

    // Apply restored draft
    applyDraft(tab.id, restored)
    stack.lastPushed = next

    return true
  }

  /**
   * Apply a full draft to the tab without triggering new undo recording.
   */
  function applyDraft(tabId: string, draft: RequestDraft): void {
    const tab = tabsStore.tabs.find(t => t.id === tabId)
    if (!tab) return

    tab.requestDraft = draft
    tabsStore.recomputeDirty(tabId)
  }

  /**
   * Initialize the undo stack for a tab with its initial state.
   */
  function initTab(tabId: string, draft: RequestDraft): void {
    const stack = getStack(tabId)
    stack.past = []
    stack.future = []
    stack.lastPushed = serializeDraft(draft)
    if (stack.timer) {
      clearTimeout(stack.timer)
      stack.timer = null
    }
  }

  /**
   * Clean up when a tab is closed.
   */
  function disposeTab(tabId: string): void {
    const stack = stacks.get(tabId)
    if (stack?.timer) {
      clearTimeout(stack.timer)
    }
    stacks.delete(tabId)
  }

  return {
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
    initTab,
    disposeTab,
  }
}
