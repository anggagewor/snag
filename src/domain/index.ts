/**
 * Snag Domain Layer
 *
 * Zero dependencies. Pure TypeScript.
 * Tidak boleh import Vue, Pinia, Tauri, atau library apapun.
 *
 * Dependency rule:
 *   Domain ← Service ← Storage ← Platform
 *   Domain ← Store ← UI
 *   Domain TIDAK BOLEH import dari layer manapun.
 */

export type {
  WorkspaceId,
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  HistoryEntryId,
} from './ids'

export type { HttpMethod, ProtocolType, KeyValuePair } from './http'

export type {
  Workspace,
  WorkspaceEntry,
} from './Workspace'

export type {
  Collection,
  TreeNode,
  Folder,
  RequestRef,
} from './Collection'

export type {
  Request,
  RequestBody,
  RequestAuth,
  RequestMeta,
  BodyType,
  AuthType,
} from './Request'

export type {
  Environment,
  EnvironmentVariable,
} from './Environment'

export type {
  HistoryEntry,
} from './History'

export type {
  GlobalSettings,
  WorkspaceSettings,
  ProxyConfig,
} from './Settings'

export { ulid, ulidTimestamp } from './ulid'
