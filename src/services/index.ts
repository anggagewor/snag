/**
 * Service Layer
 *
 * Orchestration dan business logic. Satu-satunya layer yang
 * boleh dipanggil oleh Pinia stores.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

export type {
  WorkspaceService,
  OrphanedRequest,
  WorkspaceHealth,
  ImportSource,
  ImportPreview,
  ExportFormat,
} from './WorkspaceService'

export type {
  RegistryService,
  WorkspaceValidation,
} from './RegistryService'

export type {
  HistoryService,
  HistoryFilter,
} from './HistoryService'

export type {
  SettingsService,
  ResolvedSettings,
  SettingsScope,
} from './SettingsService'

export { createWorkspaceService } from './createWorkspaceService'
export { createRegistryService } from './createRegistryService'
export { createHistoryService } from './createHistoryService'
export { createSettingsService } from './createSettingsService'

export {
  initServices,
  useWorkspaceService,
  useRegistryService,
  useHistoryService,
  useSettingsService,
  useStorageAdapter,
} from './provider'
