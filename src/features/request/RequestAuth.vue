<script setup lang="ts">
import { computed } from 'vue'

import { Ban } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { AuthType, RequestAuthDraft } from '@/domain'
import BaseEnvInput from '@/components/base/BaseEnvInput.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const auth = computed(() => props.tab.requestDraft?.auth || { type: 'none' as AuthType })

const authTypes: { label: string; value: AuthType; icon: string }[] = [
  { label: 'No Auth', value: 'none', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  { label: 'Bearer Token', value: 'bearer', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  { label: 'Basic Auth', value: 'basic', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'API Key', value: 'apikey', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
]

function setAuthType(type: AuthType) {
  if (!props.tab.requestDraft) return
  const newAuth: RequestAuthDraft = { type }
  if (type === 'bearer') newAuth.bearer = { token: '' }
  if (type === 'basic') newAuth.basic = { username: '', password: '' }
  if (type === 'apikey') newAuth.apiKey = { key: '', value: '', in: 'header' }
  props.tab.requestDraft.auth = newAuth
  tabsStore.recomputeDirty(props.tab.id)
}

function updateAuth(updates: Partial<RequestAuthDraft>) {
  if (!props.tab.requestDraft) return
  props.tab.requestDraft.auth = { ...props.tab.requestDraft.auth, ...updates }
  tabsStore.recomputeDirty(props.tab.id)
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left column: Auth type list -->
    <div class="w-[180px] flex-shrink-0 border-r border-border">
      <div class="text-xs text-muted px-3 py-2 uppercase font-medium tracking-wide">Type</div>
      <div class="space-y-0.5 px-1">
        <button
          v-for="at in authTypes"
          :key="at.value"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs rounded transition-colors text-left"
          :class="auth.type === at.value
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-secondary hover:text-primary hover:bg-surface-hover'"
          @click="setAuthType(at.value)"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="at.icon" />
          </svg>
          <span>{{ at.label }}</span>
        </button>
      </div>
    </div>

    <!-- Right column: Auth fields -->
    <div class="flex-1 px-4 py-2">
      <!-- No Auth -->
      <div v-if="auth.type === 'none'" class="flex items-center justify-center h-full">
        <div class="text-center">
          <Ban class="w-10 h-10 mx-auto text-muted/40 mb-2" :stroke-width="1.5" />
          <p class="text-sm text-muted">No authorization</p>
          <p class="text-xs text-muted mt-0.5">This request won't send any auth headers</p>
        </div>
      </div>

      <!-- Bearer Token -->
      <div v-else-if="auth.type === 'bearer'" class="space-y-3">
        <div class="text-xs text-muted uppercase font-medium tracking-wide">Bearer Token</div>
        <div class="space-y-1.5">
          <label class="block text-xs text-secondary">Token</label>
          <BaseEnvInput
            :model-value="auth.bearer?.token || ''"
            placeholder="Enter bearer token or {{variable}}"
            monospace
            @update:model-value="updateAuth({ bearer: { token: $event } })"
          />
          <p class="text-xs text-muted">Sent as: Authorization: Bearer &lt;token&gt;</p>
        </div>
      </div>

      <!-- Basic Auth -->
      <div v-else-if="auth.type === 'basic'" class="space-y-3">
        <div class="text-xs text-muted uppercase font-medium tracking-wide">Basic Authentication</div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="block text-xs text-secondary">Username</label>
            <BaseEnvInput
              :model-value="auth.basic?.username || ''"
              placeholder="Username or {{variable}}"
              @update:model-value="updateAuth({ basic: { username: $event, password: auth.basic?.password || '' } })"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs text-secondary">Password</label>
            <BaseEnvInput
              :model-value="auth.basic?.password || ''"
              placeholder="Password or {{variable}}"
              @update:model-value="updateAuth({ basic: { username: auth.basic?.username || '', password: $event } })"
            />
          </div>
          <p class="text-xs text-muted">Base64 encoded as: Authorization: Basic &lt;encoded&gt;</p>
        </div>
      </div>

      <!-- API Key -->
      <div v-else-if="auth.type === 'apikey'" class="space-y-3">
        <div class="text-xs text-muted uppercase font-medium tracking-wide">API Key</div>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="block text-xs text-secondary">Key</label>
            <BaseEnvInput
              :model-value="auth.apiKey?.key || ''"
              placeholder="e.g. X-API-Key or {{variable}}"
              monospace
              @update:model-value="updateAuth({ apiKey: { ...auth.apiKey!, key: $event } })"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs text-secondary">Value</label>
            <BaseEnvInput
              :model-value="auth.apiKey?.value || ''"
              placeholder="API key value or {{variable}}"
              monospace
              @update:model-value="updateAuth({ apiKey: { ...auth.apiKey!, value: $event } })"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs text-secondary">Add to</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm text-primary cursor-pointer">
                <input
                  type="radio"
                  name="apikey-addto"
                  :checked="auth.apiKey?.in === 'header'"
                  class="accent-accent"
                  @change="updateAuth({ apiKey: { ...auth.apiKey!, in: 'header' } })"
                />
                Header
              </label>
              <label class="flex items-center gap-2 text-sm text-primary cursor-pointer">
                <input
                  type="radio"
                  name="apikey-addto"
                  :checked="auth.apiKey?.in === 'query'"
                  class="accent-accent"
                  @change="updateAuth({ apiKey: { ...auth.apiKey!, in: 'query' } })"
                />
                Query Params
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
