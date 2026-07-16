<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

import { AlertTriangle, X, Copy } from 'lucide-vue-next'

interface AppError {
  id: string
  message: string
  stack?: string
  timestamp: string
}

const errors = ref<AppError[]>([])
const MAX_ERRORS = 5

function addError(message: string, stack?: string) {
  const appError: AppError = {
    id: crypto.randomUUID(),
    message,
    stack,
    timestamp: new Date().toLocaleTimeString(),
  }

  errors.value.unshift(appError)
  if (errors.value.length > MAX_ERRORS) {
    errors.value = errors.value.slice(0, MAX_ERRORS)
  }

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    dismissError(appError.id)
  }, 8000)
}

function dismissError(id: string) {
  errors.value = errors.value.filter((e) => e.id !== id)
}

function dismissAll() {
  errors.value = []
}

async function copyError(error: AppError) {
  const text = `${error.message}\n${error.stack || ''}`
  await navigator.clipboard.writeText(text)
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  event.preventDefault()
  const message = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason)
  const stack = event.reason instanceof Error ? event.reason.stack : undefined
  addError(message, stack)
}

function handleError(event: ErrorEvent) {
  event.preventDefault()
  addError(event.message, event.error?.stack)
}

onMounted(() => {
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  window.addEventListener('error', handleError)
})

onBeforeUnmount(() => {
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  window.removeEventListener('error', handleError)
})
</script>

<template>
  <slot />

  <!-- Error toast stack -->
  <Teleport to="body">
    <div
      v-if="errors.length > 0"
      class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[420px]"
    >
      <!-- Dismiss all -->
      <button
        v-if="errors.length > 1"
        class="self-end px-2 py-1 text-[10px] text-muted hover:text-primary bg-surface border border-border rounded transition-colors"
        @click="dismissAll"
      >
        Dismiss all
      </button>

      <TransitionGroup name="error-toast">
        <div
          v-for="error in errors"
          :key="error.id"
          class="flex items-start gap-2 p-3 bg-surface border border-error/30 rounded-lg shadow-lg"
        >
          <AlertTriangle class="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-error truncate">{{ error.message }}</p>
            <p class="text-[10px] text-muted mt-0.5">{{ error.timestamp }}</p>
          </div>
          <div class="flex gap-0.5 flex-shrink-0">
            <button
              class="p-1 text-muted hover:text-primary rounded transition-colors"
              title="Copy error"
              @click="copyError(error)"
            >
              <Copy class="w-3 h-3" />
            </button>
            <button
              class="p-1 text-muted hover:text-error rounded transition-colors"
              @click="dismissError(error.id)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.error-toast-enter-active,
.error-toast-leave-active {
  transition: all 0.3s ease;
}
.error-toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.error-toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
