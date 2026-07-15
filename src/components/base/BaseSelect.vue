<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

export interface SelectOption {
  label: string
  value: string
  icon?: string
  color?: string
}

const props = defineProps<{
  modelValue?: string
  options: SelectOption[]
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  placeholder?: string
  searchable?: boolean
  align?: 'left' | 'right'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedOption = computed(() =>
  props.options.find((o) => o.value === props.modelValue) || null
)

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  )
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => searchInputRef.value?.focus())
  }
}

function select(option: SelectOption) {
  emit('update:modelValue', option.value)
  isOpen.value = false
  searchQuery.value = ''
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
    searchQuery.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative inline-block" :class="props.align === 'right' ? 'w-auto' : 'w-full'">
    <!-- Trigger -->
    <button
      type="button"
      :disabled="disabled"
      class="flex items-center justify-between rounded-md border border-border bg-surface text-primary transition-colors hover:border-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
      :class="[
        props.align === 'right' ? 'w-auto' : 'w-full',
        size === 'sm' && 'px-2 py-1 text-xs gap-1',
        size === 'lg' && 'px-4 py-2.5 text-base gap-2',
        (!size || size === 'md') && 'px-3 py-1.5 text-sm gap-1.5',
        isOpen && 'border-accent ring-1 ring-accent/50',
      ]"
      @click="toggle"
    >
      <span class="flex items-center gap-1.5 truncate">
        <span
          v-if="selectedOption?.color"
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ backgroundColor: selectedOption.color }"
        />
        <span :class="selectedOption ? 'text-primary' : 'text-muted'">
          {{ selectedOption?.label || placeholder || 'Select...' }}
        </span>
      </span>
      <svg
        class="w-3.5 h-3.5 text-muted flex-shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 min-w-[160px] bg-surface border border-border rounded-md shadow-lg overflow-hidden"
        :class="props.align === 'right' ? 'right-0' : 'left-0 w-full'"
      >
        <!-- Search input -->
        <div v-if="searchable" class="p-1.5 border-b border-border">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            placeholder="Search..."
            class="w-full bg-surface-alt text-primary text-xs px-2 py-1.5 rounded placeholder:text-muted focus:outline-none"
          />
        </div>

        <!-- Options -->
        <div class="max-h-[200px] overflow-y-auto py-1">
          <div v-if="filteredOptions.length === 0" class="px-3 py-2 text-xs text-muted">
            No results
          </div>
          <button
            v-for="option in filteredOptions"
            :key="option.value"
            type="button"
            class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover"
            :class="option.value === modelValue ? 'bg-accent/5 text-accent' : 'text-primary'"
            @click="select(option)"
          >
            <span
              v-if="option.color"
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: option.color }"
            />
            <span class="truncate">{{ option.label }}</span>
            <svg
              v-if="option.value === modelValue"
              class="w-3.5 h-3.5 ml-auto flex-shrink-0 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
