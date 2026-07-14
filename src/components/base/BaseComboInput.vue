<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder?: string
  disabled?: boolean
  monospace?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const highlightIndex = ref(-1)

const filtered = computed(() => {
  const q = props.modelValue.toLowerCase()
  if (!q) return props.suggestions
  return props.suggestions.filter((s) => s.toLowerCase().includes(q))
})

function onFocus() {
  if (props.suggestions.length > 0) {
    isOpen.value = true
    highlightIndex.value = -1
  }
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  if (props.suggestions.length > 0) {
    isOpen.value = true
    highlightIndex.value = -1
  }
}

function selectSuggestion(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
  highlightIndex.value = -1
  nextTick(() => inputRef.value?.focus())
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value || filtered.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, -1)
  } else if (e.key === 'Enter' && highlightIndex.value >= 0) {
    e.preventDefault()
    selectSuggestion(filtered.value[highlightIndex.value])
  } else if (e.key === 'Escape') {
    isOpen.value = false
    highlightIndex.value = -1
  }
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
    highlightIndex.value = -1
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <input
      ref="inputRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full h-full bg-transparent text-primary text-xs px-2 py-2 placeholder:text-muted focus:outline-none focus:bg-surface-hover disabled:opacity-50"
      :class="{ 'font-mono': monospace }"
      @input="onInput"
      @focus="onFocus"
      @keydown="onKeyDown"
    />

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      leave-active-class="transition-all duration-75 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen && filtered.length > 0"
        class="absolute z-50 top-full left-0 mt-0.5 w-full min-w-[200px] max-h-[180px] overflow-y-auto bg-surface border border-border rounded-md shadow-lg py-0.5"
      >
        <button
          v-for="(suggestion, i) in filtered"
          :key="suggestion"
          type="button"
          class="w-full text-left px-2.5 py-1.5 text-xs transition-colors truncate"
          :class="[
            i === highlightIndex ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-surface-hover',
            monospace && 'font-mono',
          ]"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @mouseenter="highlightIndex = i"
        >
          {{ suggestion }}
        </button>
      </div>
    </Transition>
  </div>
</template>
