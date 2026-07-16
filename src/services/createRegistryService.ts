/**
 * RegistryService implementation.
 *
 * Manages ~/.snag/workspaces.json — a cache of known workspaces.
 */

import type { WorkspaceId, WorkspaceEntry } from '../domain'
import type { StorageAdapter } from '../storage'
import type { RegistryFile } from '../storage/models'
import type { RegistryService, WorkspaceValidation } from './RegistryService'
import { workspaceEntryFromRegistry, workspaceEntryToRegistry } from '../storage'

const REGISTRY_FILE = 'workspaces.json'

function emptyRegistry(): RegistryFile {
  return { version: 1, workspaces: [] }
}

export function createRegistryService(storage: StorageAdapter): RegistryService {
  async function loadRegistry(): Promise<RegistryFile> {
    const path = storage.globalPath(REGISTRY_FILE)
    const fileExists = await storage.exists(path)
    if (!fileExists) return emptyRegistry()
    try {
      return await storage.readJson<RegistryFile>(path)
    } catch {
      return emptyRegistry()
    }
  }

  async function saveRegistry(registry: RegistryFile): Promise<void> {
    const path = storage.globalPath(REGISTRY_FILE)
    await storage.writeJson(path, registry)
  }

  return {
    async listWorkspaces(): Promise<WorkspaceEntry[]> {
      const registry = await loadRegistry()
      return registry.workspaces.map(workspaceEntryFromRegistry)
    },

    async registerWorkspace(entry: WorkspaceEntry): Promise<void> {
      const registry = await loadRegistry()
      const existing = registry.workspaces.findIndex(w => w.id === entry.id)
      const registryEntry = workspaceEntryToRegistry(entry)

      const workspaces = [...registry.workspaces]
      if (existing >= 0) {
        workspaces[existing] = registryEntry
      } else {
        workspaces.push(registryEntry)
      }

      await saveRegistry({ ...registry, workspaces })
    },

    async unregisterWorkspace(id: WorkspaceId): Promise<void> {
      const registry = await loadRegistry()
      const workspaces = registry.workspaces.filter(w => w.id !== id)
      await saveRegistry({ ...registry, workspaces })
    },

    async updateLastOpened(id: WorkspaceId): Promise<void> {
      const registry = await loadRegistry()
      const workspaces = registry.workspaces.map(w =>
        w.id === id ? { ...w, lastOpenedAt: new Date().toISOString() } : w
      )
      await saveRegistry({ ...registry, workspaces })
    },

    async updatePath(id: WorkspaceId, newPath: string): Promise<void> {
      const registry = await loadRegistry()
      const workspaces = registry.workspaces.map(w =>
        w.id === id ? { ...w, path: newPath } : w
      )
      await saveRegistry({ ...registry, workspaces })
    },

    async validatePaths(): Promise<WorkspaceValidation[]> {
      const registry = await loadRegistry()
      const results: WorkspaceValidation[] = []

      for (const entry of registry.workspaces) {
        const exists = await storage.exists(entry.path)
        results.push({
          entry: workspaceEntryFromRegistry(entry),
          exists,
        })
      }

      return results
    },

    async getLastOpened(): Promise<WorkspaceEntry | null> {
      const registry = await loadRegistry()
      if (registry.workspaces.length === 0) return null

      const sorted = [...registry.workspaces].sort(
        (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
      )
      return workspaceEntryFromRegistry(sorted[0])
    },
  }
}
