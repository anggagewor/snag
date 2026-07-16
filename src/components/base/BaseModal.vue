<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title?: string
  maxWidth?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousFocus = document.activeElement as HTMLElement | null
    await nextTick()
    trapFocus()
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
    previousFocus?.focus()
    previousFocus = null
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function trapFocus() {
  if (!modalRef.value) return
  const focusable = modalRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length > 0) {
    focusable[0].focus()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }

  if (e.key !== 'Tab' || !modalRef.value) return

  const focusable = Array.from(modalRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ))
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="emit('close')" />

        <!-- Modal content -->
        <div
          ref="modalRef"
          class="relative bg-surface border border-border rounded-lg shadow-xl w-full mx-4 overflow-hidden"
          :class="maxWidth || 'max-w-md'"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? 'modal-title' : undefined"
        >
          <!-- Header -->
          <div v-if="title" class="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 id="modal-title" class="text-sm font-medium text-primary">{{ title }}</h3>
            <button
              class="text-muted hover:text-primary transition-colors"
              aria-label="Close"
              @click="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-4">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-4 py-3 border-t border-border flex justify-end gap-2">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
