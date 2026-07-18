<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { Cookie as CookieIcon, Trash2, Globe, RefreshCw } from 'lucide-vue-next'

import type { Cookie } from '@/domain'
import { useCookieJarService } from '@/services/provider'

const cookies = ref<Cookie[]>([])
const isLoading = ref(false)
const selectedDomain = ref<string | null>(null)

const domains = computed(() => {
  const set = new Set(cookies.value.map(c => c.domain))
  return [...set].sort()
})

const filteredCookies = computed(() => {
  if (!selectedDomain.value) return cookies.value
  return cookies.value.filter(c => c.domain === selectedDomain.value)
})

async function loadCookies() {
  isLoading.value = true
  try {
    const service = useCookieJarService()
    cookies.value = service.getAll()
  } catch {
    cookies.value = []
  } finally {
    isLoading.value = false
  }
}

async function removeCookie(cookie: Cookie) {
  const service = useCookieJarService()
  await service.remove(cookie.name, cookie.domain)
  await loadCookies()
}

async function removeDomain(domain: string) {
  const service = useCookieJarService()
  await service.removeForDomain(domain)
  if (selectedDomain.value === domain) {
    selectedDomain.value = null
  }
  await loadCookies()
}

async function clearAll() {
  const service = useCookieJarService()
  await service.clearAll()
  selectedDomain.value = null
  await loadCookies()
}

function formatExpires(expires?: string): string {
  if (!expires) return 'Session'
  const date = new Date(expires)
  if (date.getTime() < Date.now()) return 'Expired'
  return date.toLocaleString()
}

onMounted(loadCookies)
</script>

<template>
  <div class="flex h-full">
    <!-- Domain list (left) -->
    <div class="w-[200px] flex-shrink-0 border-r border-border flex flex-col">
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <span class="text-xs font-medium text-secondary">Domains</span>
        <div class="flex items-center gap-1">
          <button
            class="p-1 text-muted hover:text-primary rounded transition-colors"
            title="Refresh"
            @click="loadCookies"
          >
            <RefreshCw class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="cookies.length > 0"
            class="p-1 text-muted hover:text-error rounded transition-colors"
            title="Clear all cookies"
            @click="clearAll"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <!-- All domains option -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
          :class="!selectedDomain ? 'bg-accent/10 text-accent font-medium' : 'text-primary hover:bg-surface-hover'"
          @click="selectedDomain = null"
        >
          <Globe class="w-3.5 h-3.5 flex-shrink-0" />
          <span>All ({{ cookies.length }})</span>
        </button>

        <!-- Per-domain list -->
        <div
          v-for="domain in domains"
          :key="domain"
          class="flex items-center group"
        >
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors truncate"
            :class="selectedDomain === domain ? 'bg-accent/10 text-accent font-medium' : 'text-primary hover:bg-surface-hover'"
            @click="selectedDomain = domain"
          >
            <CookieIcon class="w-3.5 h-3.5 flex-shrink-0 text-warning" />
            <span class="truncate">{{ domain }}</span>
            <span class="ml-auto text-[10px] text-muted">{{ cookies.filter(c => c.domain === domain).length }}</span>
          </button>
          <button
            class="p-1 mr-1 text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded"
            title="Remove all cookies for this domain"
            @click.stop="removeDomain(domain)"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="domains.length === 0 && !isLoading" class="px-3 py-8 text-center">
          <CookieIcon class="w-8 h-8 mx-auto text-muted/30 mb-2" :stroke-width="1.5" />
          <p class="text-xs text-muted">No cookies stored</p>
          <p class="text-[10px] text-muted mt-0.5">Cookies will appear here after sending requests</p>
        </div>
      </div>
    </div>

    <!-- Cookie table (right) -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center px-3 py-2 border-b border-border">
        <span class="text-xs font-medium text-secondary">
          {{ selectedDomain ?? 'All Cookies' }}
        </span>
        <span class="ml-2 text-[10px] text-muted">({{ filteredCookies.length }})</span>
      </div>

      <div class="flex-1 overflow-auto">
        <table v-if="filteredCookies.length > 0" class="w-full text-xs">
          <thead>
            <tr class="border-b border-border text-left text-muted">
              <th class="px-3 py-2 font-medium">Name</th>
              <th class="px-3 py-2 font-medium">Value</th>
              <th class="px-3 py-2 font-medium">Domain</th>
              <th class="px-3 py-2 font-medium">Path</th>
              <th class="px-3 py-2 font-medium">Expires</th>
              <th class="px-3 py-2 font-medium">Flags</th>
              <th class="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="cookie in filteredCookies"
              :key="`${cookie.domain}:${cookie.name}:${cookie.path}`"
              class="border-b border-border-muted hover:bg-surface-hover group"
            >
              <td class="px-3 py-2 font-medium text-primary whitespace-nowrap">{{ cookie.name }}</td>
              <td class="px-3 py-2 text-secondary font-mono max-w-[200px] truncate" :title="cookie.value">
                {{ cookie.value }}
              </td>
              <td class="px-3 py-2 text-secondary whitespace-nowrap">{{ cookie.domain }}</td>
              <td class="px-3 py-2 text-secondary font-mono">{{ cookie.path }}</td>
              <td class="px-3 py-2 text-secondary whitespace-nowrap">{{ formatExpires(cookie.expires) }}</td>
              <td class="px-3 py-2">
                <div class="flex gap-1">
                  <span v-if="cookie.secure" class="px-1 py-0.5 text-[9px] rounded bg-success/10 text-success">Secure</span>
                  <span v-if="cookie.httpOnly" class="px-1 py-0.5 text-[9px] rounded bg-warning/10 text-warning">HttpOnly</span>
                  <span v-if="cookie.sameSite" class="px-1 py-0.5 text-[9px] rounded bg-accent/10 text-accent">{{ cookie.sameSite }}</span>
                </div>
              </td>
              <td class="px-3 py-2">
                <button
                  class="p-1 text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity rounded"
                  title="Delete cookie"
                  @click="removeCookie(cookie)"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty state for filtered -->
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center">
            <CookieIcon class="w-10 h-10 mx-auto text-muted/30 mb-2" :stroke-width="1.5" />
            <p class="text-sm text-muted">No cookies</p>
            <p class="text-xs text-muted mt-0.5">Send requests to capture cookies automatically</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
