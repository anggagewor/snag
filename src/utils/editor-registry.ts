import type { EditorView } from '@codemirror/view'

/**
 * Global registry of mounted CodeMirror EditorView instances.
 * Used to programmatically open search (Cmd+F) from the global keyboard handler.
 */
const editors = new Set<EditorView>()

export function registerEditor(view: EditorView): void {
  editors.add(view)
}

export function unregisterEditor(view: EditorView): void {
  editors.delete(view)
}

/**
 * Get the first registered editor that is visible in the viewport.
 * Prefers editors that are in a visible response panel.
 */
export function getVisibleEditor(): EditorView | null {
  for (const view of editors) {
    if (view.dom.offsetParent !== null) {
      return view
    }
  }
  return null
}
