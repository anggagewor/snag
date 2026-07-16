/**
 * Settings domain model.
 *
 * Dua layer: Global (milik user) dan Workspace (milik project).
 * Merge strategy: workspace overrides global.
 */

export interface GlobalSettings {
  readonly theme: 'light' | 'dark' | 'system'
  readonly fontSize: number
  readonly fontFamily: string
  readonly language: string
}

export interface WorkspaceSettings {
  readonly proxy?: ProxyConfig
  readonly defaultHeaders?: readonly { readonly key: string; readonly value: string }[]
  readonly timeout?: number
  readonly followRedirects?: boolean
  readonly validateSsl?: boolean
}

export interface ProxyConfig {
  readonly enabled: boolean
  readonly url: string
  readonly auth?: {
    readonly username: string
    readonly password: string
  }
}
