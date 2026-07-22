/**
 * useWebSocket — composable for WebSocket connections.
 *
 * Manages connect/disconnect, message sending/receiving, and session state.
 * Uses browser WebSocket API (works in both Tauri and dev mode).
 */

import { ref, computed } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import type { WebSocketConfig, WebSocketSession, WebSocketMessage } from '@/domain'

export function useWebSocket() {
  const session = ref<WebSocketSession>({
    status: 'disconnected',
    messages: [],
  })

  const isConnected = computed(() => session.value.status === 'connected')
  const isConnecting = computed(() => session.value.status === 'connecting')
  const messageCount = computed(() => session.value.messages.length)

  let socket: WebSocket | null = null

  function resolve(str: string, collectionVariables?: { key: string; value: string }[]): string {
    const workspaceStore = useWorkspaceStore()
    return workspaceStore.resolveVariablesInString(str, collectionVariables)
  }

  function connect(config: WebSocketConfig, collectionVariables?: { key: string; value: string }[]): void {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }

    session.value = {
      status: 'connecting',
      messages: [],
    }

    const resolvedUrl = resolve(config.url, collectionVariables)

    // Build sub-protocols from headers if specified
    const protocols: string[] = []
    const headers = config.headers.filter(h => h.enabled && h.key)
    const protocolHeader = headers.find(h => h.key.toLowerCase() === 'sec-websocket-protocol')
    if (protocolHeader) {
      protocols.push(...protocolHeader.value.split(',').map(p => p.trim()))
    }

    try {
      socket = protocols.length > 0
        ? new WebSocket(resolvedUrl, protocols)
        : new WebSocket(resolvedUrl)

      socket.onopen = () => {
        session.value = {
          ...session.value,
          status: 'connected',
          connectedAt: new Date().toISOString(),
        }

        // Send initial message if configured
        if (config.initialMessage) {
          const resolved = resolve(config.initialMessage, collectionVariables)
          sendMessage(resolved)
        }
      }

      socket.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : '[binary data]'
        const message: WebSocketMessage = {
          id: crypto.randomUUID(),
          direction: 'received',
          data,
          timestamp: new Date().toISOString(),
          size: new Blob([data]).size,
        }
        session.value = {
          ...session.value,
          messages: [...session.value.messages, message],
        }
      }

      socket.onerror = () => {
        session.value = {
          ...session.value,
          status: 'error',
          error: 'WebSocket connection error',
        }
      }

      socket.onclose = (event) => {
        const wasConnected = session.value.status === 'connected'
        session.value = {
          ...session.value,
          status: 'disconnected',
          error: wasConnected
            ? (event.code !== 1000 ? `Connection closed: ${event.code} ${event.reason || ''}`.trim() : undefined)
            : session.value.error,
        }
        socket = null
      }
    } catch (err) {
      session.value = {
        ...session.value,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  function disconnect(): void {
    if (socket) {
      socket.close(1000, 'User disconnected')
      socket = null
    }
    session.value = {
      ...session.value,
      status: 'disconnected',
    }
  }

  function sendMessage(data: string): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    socket.send(data)

    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      direction: 'sent',
      data,
      timestamp: new Date().toISOString(),
      size: new Blob([data]).size,
    }
    session.value = {
      ...session.value,
      messages: [...session.value.messages, message],
    }
  }

  function clearMessages(): void {
    session.value = {
      ...session.value,
      messages: [],
    }
  }

  return {
    session,
    isConnected,
    isConnecting,
    messageCount,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  }
}
