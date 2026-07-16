/**
 * Branded ID types.
 *
 * Secara runtime tetap string, tapi compile-time mencegah
 * assignment antar tipe ID yang berbeda.
 *
 * Contoh:
 *   const reqId: RequestId = 'abc' as RequestId
 *   const colId: CollectionId = reqId  // ❌ Type error
 */

declare const __brand: unique symbol

type Brand<T, B extends string> = T & { readonly [__brand]: B }

export type WorkspaceId = Brand<string, 'WorkspaceId'>
export type CollectionId = Brand<string, 'CollectionId'>
export type RequestId = Brand<string, 'RequestId'>
export type EnvironmentId = Brand<string, 'EnvironmentId'>
export type FolderId = Brand<string, 'FolderId'>
export type HistoryEntryId = Brand<string, 'HistoryEntryId'>
