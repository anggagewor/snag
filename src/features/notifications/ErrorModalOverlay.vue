<script setup lang="ts">
import { computed } from 'vue'
import { XCircle } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useNotificationStore } from '@/stores/notifications'

const store = useNotificationStore()

const activeModal = computed(() => store.modalQueue[0] ?? null)
const isOpen = computed(() => activeModal.value !== null)

function acknowledge() {
  if (activeModal.value) {
    store.acknowledgeModal(activeModal.value.id)
  }
}
</script>

<template>
  <BaseModal
    :open="isOpen"
    :title="activeModal?.title"
    @close="acknowledge"
  >
    <div v-if="activeModal" class="flex flex-col items-center gap-3 text-center">
      <XCircle class="w-8 h-8 text-error" />
      <p class="text-sm text-secondary">{{ activeModal.message }}</p>
    </div>

    <template #footer>
      <BaseButton variant="primary" @click="acknowledge">
        Acknowledge
      </BaseButton>
    </template>
  </BaseModal>
</template>
