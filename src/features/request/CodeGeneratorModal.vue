<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { Copy, Check } from 'lucide-vue-next'

import BaseModal from '@/components/base/BaseModal.vue'
import BaseCodeEditor from '@/components/base/BaseCodeEditor.vue'
import type { EditorLanguage } from '@/components/base/BaseCodeEditor.vue'
import type { RequestDraft } from '@/domain'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import { generateCode, CODEGEN_TARGETS } from '@/utils/codegen'

const props = defineProps<{
  open: boolean
  request: RequestDraft | null
}>()

const emit = defineEmits<{
  close: []
}>()

const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

const selectedTarget = ref(CODEGEN_TARGETS[0].id)
const copied = ref(false)

/**
 * Create a resolved copy of the request with all variables and path params substituted.
 */
function resolveRequest(request: RequestDraft): RequestDraft {
  const collectionVars = tabsStore.activeTab?.collectionVariables
  const resolve = (str: string) => workspaceStore.resolveVariablesInString(str, collectionVars)

  // Resolve path params in URL
  let url = resolve(request.url)
  if (request.pathParams?.length) {
    for (const param of request.pathParams) {
      if (param.enabled && param.key && param.value) {
        url = url.replace(new RegExp(`:${param.key}\\b`, 'g'), resolve(param.value))
      }
    }
  }

  return {
    ...request,
    url,
    headers: request.headers.map(h => ({
      ...h,
      key: resolve(h.key),
      value: resolve(h.value),
    })),
    params: request.params.map(p => ({
      ...p,
      key: resolve(p.key),
      value: resolve(p.value),
    })),
    body: {
      ...request.body,
      content: resolve(request.body.content),
      formData: request.body.formData?.map(f => ({
        ...f,
        key: resolve(f.key),
        value: resolve(f.value),
      })),
    },
    auth: {
      ...request.auth,
      bearer: request.auth.bearer ? { token: resolve(request.auth.bearer.token) } : undefined,
      basic: request.auth.basic ? { username: resolve(request.auth.basic.username), password: resolve(request.auth.basic.password) } : undefined,
      apiKey: request.auth.apiKey ? { key: resolve(request.auth.apiKey.key), value: resolve(request.auth.apiKey.value), in: request.auth.apiKey.in } : undefined,
    },
  }
}

const generatedCode = computed(() => {
  if (!props.request) return ''
  const resolved = resolveRequest(props.request)
  return generateCode(selectedTarget.value, resolved)
})

const editorLanguage = computed((): EditorLanguage => {
  const target = CODEGEN_TARGETS.find(t => t.id === selectedTarget.value)
  if (!target) return 'text'
  if (target.language === 'javascript') return 'javascript'
  return 'text'
})

watch(() => props.open, (isOpen) => {
  if (isOpen) copied.value = false
})

async function copyCode() {
  await navigator.clipboard.writeText(generatedCode.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <BaseModal :open="open" title="Generate Code" max-width="max-w-2xl" @close="emit('close')">
    <div class="flex gap-4 h-[420px]">
      <!-- Target list -->
      <div class="w-[180px] flex-shrink-0 border-r border-border overflow-auto -m-4 mr-0 pr-0">
        <div class="p-2 space-y-0.5">
          <button
            v-for="target in CODEGEN_TARGETS"
            :key="target.id"
            class="w-full text-left px-3 py-2 text-xs rounded transition-colors"
            :class="selectedTarget === target.id
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-secondary hover:text-primary hover:bg-surface-hover'"
            @click="selectedTarget = target.id"
          >
            {{ target.label }}
          </button>
        </div>
      </div>

      <!-- Code output -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Actions bar -->
        <div class="flex items-center justify-end pb-2 flex-shrink-0">
          <button
            class="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
            @click="copyCode"
          >
            <Check v-if="copied" class="w-3.5 h-3.5 text-success" />
            <Copy v-else class="w-3.5 h-3.5" />
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>

        <!-- Editor -->
        <div class="flex-1 min-h-0">
          <BaseCodeEditor
            :model-value="generatedCode"
            :language="editorLanguage"
            :readonly="true"
          />
        </div>
      </div>
    </div>
  </BaseModal>
</template>
