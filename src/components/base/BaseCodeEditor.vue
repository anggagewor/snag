<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'

import { EditorView, keymap, lineNumbers, highlightActiveLine, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from '@codemirror/language'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap, search } from '@codemirror/search'

export type EditorLanguage = 'json' | 'javascript' | 'html' | 'xml' | 'text'

const props = withDefaults(defineProps<{
  modelValue?: string
  language?: EditorLanguage
  readonly?: boolean
  placeholder?: string
}>(), {
  modelValue: '',
  language: 'json',
  readonly: false,
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLDivElement | null>(null)
const view = shallowRef<EditorView | null>(null)
let ignoreUpdate = false

function getLanguageExtension(lang: EditorLanguage) {
  switch (lang) {
    case 'json': return json()
    case 'javascript': return javascript()
    case 'html': return html()
    case 'xml': return xml()
    default: return []
  }
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

function buildExtensions() {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    autocompletion(),
    highlightSelectionMatches(),
    search({ top: true }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...searchKeymap, indentWithTab]),
    getLanguageExtension(props.language),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !ignoreUpdate) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '12px',
      },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        overflow: 'auto',
      },
      '.cm-gutters': {
        border: 'none',
      },
    }),
  ]

  if (props.placeholder) {
    extensions.push(cmPlaceholder(props.placeholder))
  }

  if (props.readonly) {
    extensions.push(EditorState.readOnly.of(true))
  }

  if (isDarkMode()) {
    extensions.push(oneDark)
  }

  return extensions
}

onMounted(() => {
  if (!editorContainer.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: buildExtensions(),
  })

  view.value = new EditorView({
    state,
    parent: editorContainer.value,
  })
})

onBeforeUnmount(() => {
  view.value?.destroy()
})

watch(() => props.modelValue, (newVal) => {
  if (!view.value) return
  const currentVal = view.value.state.doc.toString()
  if (newVal !== currentVal) {
    ignoreUpdate = true
    view.value.dispatch({
      changes: { from: 0, to: currentVal.length, insert: newVal },
    })
    ignoreUpdate = false
  }
})

watch(() => props.language, () => {
  if (!view.value) return
  const currentDoc = view.value.state.doc.toString()
  const state = EditorState.create({
    doc: currentDoc,
    extensions: buildExtensions(),
  })
  view.value.setState(state)
})

// Observe dark mode changes
const observer = new MutationObserver(() => {
  if (!view.value) return
  const currentDoc = view.value.state.doc.toString()
  const state = EditorState.create({
    doc: currentDoc,
    extensions: buildExtensions(),
  })
  view.value.setState(state)
})

onMounted(() => {
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  observer.disconnect()
})
</script>

<template>
  <div
    ref="editorContainer"
    class="h-full w-full rounded-md border border-border overflow-hidden bg-surface [&_.cm-focused]:outline-none [&_.cm-focused]:border-accent"
  />
</template>
