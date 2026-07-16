<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'

import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-vue-next'

import { useNotificationStore } from '@/stores/notifications'
import BaseButton from '@/components/base/BaseButton.vue'
import type { ToastNotification } from '@/stores/notifications'

const store = useNotificationStore()

const visibleToasts = computed(() => store.toastQueue.slice(-5))

const timers = new Map<string, ReturnType<typeof setTimeout>>()

const iconMap = {
  success: CheckCircle,
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
} as const

const iconColorMap = {
  success: 'text-success',
  info: 'text-accent',
  warn: 'text-warning',
  error: 'text-error',
} as const

function startTimer(toast: ToastNotification) {
  if (toast.persistent || timers.has(toast.id)) return
  const timer = setTimeout(() => {
    store.dismiss(toast.id)
    timers.delete(toast.id)
  }, 3000)
  timers.set(toast.id, timer)
}

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function handleDismiss(id: string) {
  clearTimer(id)
  store.dismiss(id)
}

function handleAction(id: string) {
  clearTimer(id)
  store.executeAction(id)
}

watch(
  () => store.toastQueue,
  (queue) => {
    for (const toast of queue) {
      startTimer(toast)
    }
  },
  { deep: true, immediate: true },
)

onUnmounted(() => {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
})
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in visibleToasts"
        :key="toast.id"
        class="flex items-start gap-3 p-3 rounded-lg border bg-surface border-border shadow-lg dark:shadow-none"
      >
        <component
          :is="iconMap[toast.type]"
          :class="iconColorMap[toast.type]"
          class="w-5 h-5 shrink-0 mt-0.5"
        />

        <div class="flex-1 min-w-0">
          <p class="text-sm text-primary break-words">{{ toast.message }}</p>
          <BaseButton
            v-if="toast.action"
            size="sm"
            variant="secondary"
            class="mt-2"
            @click="handleAction(toast.id)"
          >
            {{ toast.action.label }}
          </BaseButton>
        </div>

        <button
          class="shrink-0 p-0.5 rounded text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
          aria-label="Dismiss notification"
          @click="handleDismiss(toast.id)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
