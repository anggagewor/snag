<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

import { useEnvironmentsStore } from '@/stores/environments'
import BaseModal from '@/components/base/BaseModal.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  monospace?: boolean
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const environmentsStore = useEnvironmentsStore()
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

const isOpen = ref(false)
const highlightIndex = ref(-1)
const cursorPos = ref(0)

// Modal state
const showModal = ref(false)
const modalMode = ref<'edit' | 'create'>('create')
const modalVarName = ref('')
const modalVarValue = ref('')
const modalNameInputRef = ref<HTMLInputElement | null>(null)
const modalValueInputRef = ref<HTMLInputElement | null>(null)

const variableContext = computed(() => {
  const val = props.modelValue
  const pos = cursorPos.value

  const before = val.slice(0, pos)
  const openIndex = before.lastIndexOf('{{')
  if (openIndex === -1) return null

  const between = before.slice(openIndex + 2)
  if (between.includes('}}')) return null

  return { query: between, startIndex: openIndex }
})

const suggestions = computed(() => {
  if (!variableContext.value) return []
  const allVars = Object.keys(environmentsStore.resolvedVariables)
  const q = variableContext.value.query.toLowerCase()
  if (!q) return allVars
  return allVars.filter((v) => v.toLowerCase().includes(q))
})

const canCreateNew = computed(() => {
  if (!variableContext.value) return false
  const q = variableContext.value.query
  if (!q) return false
  return !Object.keys(environmentsStore.resolvedVariables).includes(q)
})

watch(variableContext, () => {
  if (variableContext.value) {
    const hasItems = suggestions.value.length > 0 || canCreateNew.value
    isOpen.value = hasItems
    highlightIndex.value = suggestions.value.length > 0 ? 0 : -1
  } else {
    isOpen.value = false
    highlightIndex.value = -1
  }
})

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  emit('update:modelValue', input.value)
  cursorPos.value = input.selectionStart || 0
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) return

  const totalItems = suggestions.value.length + (canCreateNew.value ? 1 : 0)
  if (totalItems === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, totalItems - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (highlightIndex.value >= 0 && highlightIndex.value < suggestions.value.length) {
      e.preventDefault()
      selectSuggestion(suggestions.value[highlightIndex.value])
    } else if (highlightIndex.value === suggestions.value.length && canCreateNew.value) {
      e.preventDefault()
      openCreateModal()
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

function selectSuggestion(varName: string) {
  if (!variableContext.value) return

  const val = props.modelValue
  const { startIndex, query } = variableContext.value

  const before = val.slice(0, startIndex)
  const after = val.slice(startIndex + 2 + query.length)
  const newVal = `${before}{{${varName}}}${after}`

  emit('update:modelValue', newVal)
  isOpen.value = false

  const newCursorPos = startIndex + varName.length + 4
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.setSelectionRange(newCursorPos, newCursorPos)
      inputRef.value.focus()
    }
  })
}

function openEditModal(varName: string) {
  modalMode.value = 'edit'
  modalVarName.value = varName
  modalVarValue.value = environmentsStore.resolvedVariables[varName] || ''
  isOpen.value = false
  showModal.value = true
  nextTick(() => modalValueInputRef.value?.focus())
}

function openCreateModal() {
  modalMode.value = 'create'
  modalVarName.value = variableContext.value?.query || ''
  modalVarValue.value = ''
  isOpen.value = false
  showModal.value = true
  nextTick(() => {
    if (modalVarName.value) {
      modalValueInputRef.value?.focus()
    } else {
      modalNameInputRef.value?.focus()
    }
  })
}

function saveModal() {
  if (!modalVarName.value.trim()) return

  if (modalMode.value === 'edit') {
    const env = environmentsStore.activeEnvironment
    if (!env) return
    const vars = [...env.variables]
    const idx = vars.findIndex((v) => v.key === modalVarName.value)
    if (idx !== -1) {
      vars[idx] = { ...vars[idx], value: modalVarValue.value }
    }
    environmentsStore.updateEnvironment(env.id, { variables: vars })
  } else {
    let env = environmentsStore.activeEnvironment
    if (!env) {
      const created = environmentsStore.createEnvironment('Default')
      environmentsStore.setActive(created.id)
      env = created
    }
    const vars = [...env.variables, { key: modalVarName.value.trim(), value: modalVarValue.value, enabled: true }]
    environmentsStore.updateEnvironment(env.id, { variables: vars })
    selectSuggestion(modalVarName.value.trim())
  }

  showModal.value = false
}

function closeModal() {
  showModal.value = false
  nextTick(() => inputRef.value?.focus())
}

function onClick() {
  nextTick(() => { cursorPos.value = inputRef.value?.selectionStart || 0 })
}

function onKeyUp() {
  cursorPos.value = inputRef.value?.selectionStart || 0
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))

defineExpose({ inputRef })
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <input
      ref="inputRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full text-primary placeholder:text-muted focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        monospace && 'font-mono',
        size === 'sm'
          ? 'bg-transparent px-2 py-2 text-xs focus:bg-surface-hover'
          : 'rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent/50',
      ]"
      @input="onInput"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @click="onClick"
    />

    <!-- Variable autocomplete dropdown -->
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      leave-active-class="transition-all duration-75 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 top-full left-0 mt-1 w-full min-w-[200px] max-h-[200px] overflow-y-auto bg-surface border border-border rounded-md shadow-lg"
      >
        <div class="px-2.5 py-1 text-[10px] text-muted uppercase tracking-wider border-b border-border">
          Variables
          <span v-if="environmentsStore.activeEnvironment" class="normal-case tracking-normal">
            · {{ environmentsStore.activeEnvironment.name }}
          </span>
        </div>

        <div v-if="suggestions.length > 0" class="py-0.5">
          <div
            v-for="(varName, i) in suggestions"
            :key="varName"
            class="flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors group/var"
            :class="i === highlightIndex ? 'bg-accent/5' : 'hover:bg-surface-hover'"
            @mouseenter="highlightIndex = i"
          >
            <button
              type="button"
              class="flex-1 flex items-center justify-between text-left min-w-0"
              @mousedown.prevent="selectSuggestion(varName)"
            >
              <span class="font-mono text-primary truncate">{{ varName }}</span>
              <span class="text-[10px] text-muted font-mono truncate ml-2 max-w-[140px]">
                {{ environmentsStore.resolvedVariables[varName] }}
              </span>
            </button>
            <button
              type="button"
              class="flex-shrink-0 p-0.5 text-muted hover:text-accent rounded opacity-0 group-hover/var:opacity-100"
              @mousedown.prevent="openEditModal(varName)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="canCreateNew" class="border-t border-border">
          <button
            type="button"
            class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors"
            :class="highlightIndex === suggestions.length ? 'bg-accent/5 text-accent' : 'text-secondary hover:bg-surface-hover'"
            @mousedown.prevent="openCreateModal"
            @mouseenter="highlightIndex = suggestions.length"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create "<span class="font-mono">{{ variableContext?.query }}</span>"</span>
          </button>
        </div>

        <div v-if="suggestions.length === 0 && !canCreateNew" class="px-2.5 py-2 text-xs text-muted text-center">
          No variables found
        </div>
      </div>
    </Transition>

    <!-- Modal -->
    <BaseModal :open="showModal" :title="modalMode === 'edit' ? 'Edit Variable' : 'New Variable'" @close="closeModal">
      <div class="space-y-3">
        <div class="space-y-1">
          <label class="block text-xs text-secondary">Variable Name</label>
          <input
            ref="modalNameInputRef"
            v-model="modalVarName"
            :disabled="modalMode === 'edit'"
            placeholder="e.g. baseUrl"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-2 font-mono placeholder:text-muted focus:outline-none focus:border-accent disabled:opacity-60 disabled:bg-surface-alt"
          />
        </div>
        <div class="space-y-1">
          <label class="block text-xs text-secondary">Value</label>
          <input
            ref="modalValueInputRef"
            v-model="modalVarValue"
            placeholder="e.g. https://api.example.com"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-2 font-mono placeholder:text-muted focus:outline-none focus:border-accent"
            @keydown.enter="saveModal"
          />
        </div>
        <p v-if="!environmentsStore.activeEnvironment && modalMode === 'create'" class="text-xs text-warning">
          No active environment — a "Default" one will be created
        </p>
      </div>
      <template #footer>
        <button class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary" @click="closeModal">Cancel</button>
        <button
          class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          :disabled="!modalVarName.trim()"
          @click="saveModal"
        >{{ modalMode === 'edit' ? 'Save' : 'Create & Insert' }}</button>
      </template>
    </BaseModal>
  </div>
</template>
