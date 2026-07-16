/**
 * Storage Layer
 *
 * Bertanggung jawab atas persistence — baca/tulis ke disk.
 * Boleh import dari domain/. TIDAK BOLEH import dari store/ atau UI.
 */

export type { StorageAdapter, FileEvent, Unsubscribe } from './StorageAdapter'

export type {
  FileHeader,
  WorkspaceFile,
  CollectionFile,
  CollectionFileTreeNode,
  CollectionFileFolder,
  CollectionFileRequestRef,
  CollectionFileVariable,
  RequestFile,
  RequestFileBody,
  RequestFileAuth,
  RequestFileKeyValue,
  RequestFileMeta,
  EnvironmentFile,
  EnvironmentFileVariable,
  RegistryFile,
  RegistryEntry,
  HistoryFile,
  HistoryFileEntry,
  GlobalSettingsFile,
  WorkspaceSettingsFile,
} from './models'

export {
  workspaceFromFile,
  workspaceToFile,
  collectionFromFile,
  collectionToFile,
  requestFromFile,
  requestToFile,
  environmentFromFile,
  environmentToFile,
  historyEntryFromFile,
  historyEntryToFile,
  workspaceEntryFromRegistry,
  workspaceEntryToRegistry,
  globalSettingsFromFile,
  globalSettingsToFile,
  workspaceSettingsFromFile,
  workspaceSettingsToFile,
} from './mappers'

export {
  createTauriStorageAdapter,
  setWorkspaceRoot,
  getWorkspaceRoot,
  initGlobalRoot,
} from './TauriStorageAdapter'
