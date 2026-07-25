import { onMounted, onBeforeUnmount } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import { useHttp } from '@/composables/useHttp'
import { useHistoryStore } from '@/stores/history'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { openSearchPanel } from '@codemirror/search'
import { getVisibleEditor } from '@/utils/editor-registry'

export function useKeyboard() {
  const tabsStore = useTabsStore()
  const historyStore = useHistoryStore()
  const { sendRequest } = useHttp()
  const { undo, redo } = useUndoRedo()

  async function handleSendRequest() {
    const tab = tabsStore.activeTab
    if (!tab || tab.type !== 'request' || !tab.requestDraft?.url) return

    const draft = tab.requestDraft
    const response = await sendRequest(draft, tab.collectionVariables, tab.sourceId)
    tabsStore.updateTabResponse(tab.id, response)
    if (response) {
      historyStore.recordEntry({
        method: (draft.method ?? 'GET') as import('@/domain').HttpMethod,
        url: response.requestUrl ?? draft.url ?? '',
        status: response.status,
        duration: response.time ?? 0,
        responseSize: response.size ?? 0,
      })
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const isMeta = e.metaKey || e.ctrlKey

    if (!isMeta) return

    switch (e.key) {
      case 'Enter': {
        e.preventDefault()
        handleSendRequest()
        break
      }
      case 't': {
        e.preventDefault()
        tabsStore.openRequestTab()
        break
      }
      case 'w': {
        e.preventDefault()
        if (tabsStore.activeTabId) {
          tabsStore.closeTab(tabsStore.activeTabId)
        }
        break
      }
      case 's': {
        e.preventDefault()
        const tab = tabsStore.activeTab
        if (tab && tab.type === 'request' && tab.isDirty) {
          tabsStore.saveTab(tab.id)
        }
        break
      }
      case 'z': {
        // Don't interfere with CodeMirror's own undo
        if ((e.target as HTMLElement)?.closest?.('.cm-editor')) break
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        break
      }
      case 'y': {
        if ((e.target as HTMLElement)?.closest?.('.cm-editor')) break
        e.preventDefault()
        redo()
        break
      }
      case 'f': {
        // If already inside a CodeMirror, let it handle its own search
        if ((e.target as HTMLElement)?.closest?.('.cm-editor')) break

        // Find a visible CodeMirror editor and open its search panel
        const editor = getVisibleEditor()
        if (editor) {
          e.preventDefault()
          editor.focus()
          openSearchPanel(editor)
        }
        break
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
