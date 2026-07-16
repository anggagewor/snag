/**
 * Scratch Pad — always-available workspace.
 *
 * Lives at ~/.snag/scratch/. Real workspace, persistent,
 * but cannot be Git-synced or shared.
 *
 * Created automatically on first launch if it doesn't exist.
 */

import type { WorkspaceId, CollectionId } from '../domain'
import { ulid } from '../domain'
import type { StorageAdapter } from '../storage'
import type { WorkspaceFile, CollectionFile } from '../storage/models'

const SCRATCH_DIR = 'scratch'
const SCRATCH_WORKSPACE_NAME = 'Scratch Pad'
const SCRATCH_COLLECTION_NAME = 'Requests'

export async function ensureScratchPad(storage: StorageAdapter): Promise<string> {
  const scratchPath = storage.globalPath(SCRATCH_DIR)
  const manifestPath = `${scratchPath}/workspace.json`

  const exists = await storage.exists(manifestPath)
  if (exists) return scratchPath

  // Create scratch workspace
  await storage.ensureDir(scratchPath)
  await storage.ensureDir(`${scratchPath}/collections`)
  await storage.ensureDir(`${scratchPath}/requests`)
  await storage.ensureDir(`${scratchPath}/environments`)

  const workspaceId = ulid() as WorkspaceId
  const collectionId = ulid() as CollectionId
  const timestamp = new Date().toISOString()

  // Create default collection
  const collectionFile: CollectionFile = {
    type: 'collection',
    version: 1,
    id: collectionId,
    name: SCRATCH_COLLECTION_NAME,
    variables: [],
    items: [],
  }
  await storage.writeJson(`${scratchPath}/collections/${collectionId}.collection.json`, collectionFile)

  // Create workspace manifest
  const workspaceFile: WorkspaceFile = {
    type: 'workspace',
    version: 1,
    id: workspaceId,
    name: SCRATCH_WORKSPACE_NAME,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    defaultEnvironment: null,
    collections: [collectionId],
  }
  await storage.writeJson(manifestPath, workspaceFile)

  return scratchPath
}

export function getScratchPadPath(storage: StorageAdapter): string {
  return storage.globalPath(SCRATCH_DIR)
}
