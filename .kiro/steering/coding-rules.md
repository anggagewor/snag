---
inclusion: always
---

# Snag — Coding Rules

## General

- Language: TypeScript (strict mode, no `any` unless absolutely necessary)
- Framework: Vue 3 Composition API (`<script setup lang="ts">`) — never use Options API
- Styling: Tailwind CSS utility-first, custom CSS hanya untuk hal yang benar-benar tidak bisa di-handle Tailwind
- State: Pinia stores, selalu typed
- No magic strings — gunakan constants/enums untuk values yang dipakai berulang

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files (components) | PascalCase | `BaseButton.vue` |
| Files (composables) | camelCase with `use` prefix | `useTheme.ts` |
| Files (stores) | camelCase | `collections.ts` |
| Files (types) | camelCase | `request.ts` |
| Files (utils) | kebab-case | `curl-parser.ts` |
| Variables/functions | camelCase | `isLoading`, `sendRequest()` |
| Types/Interfaces | PascalCase, no `I` prefix | `RequestConfig`, `Collection` |
| Enums | PascalCase (name), UPPER_SNAKE (values) | `HttpMethod.GET` |
| Constants | UPPER_SNAKE_CASE | `MAX_HISTORY_ITEMS` |
| CSS classes (custom) | kebab-case | `.split-pane-handle` |
| Events (emit) | camelCase | `@updateValue` |
| Props | camelCase in script, kebab-case in template | `:is-loading` |

## Component Rules

- Base components (reusable/generic) → `src/components/base/`
- Feature components → `src/features/{feature-name}/`
- Satu component = satu file, max ~200 lines. Kalau lebih, pecah.
- Props wajib di-type explicit dengan `defineProps<T>()`
- Emits wajib di-type explicit dengan `defineEmits<T>()`
- Gunakan `v-model` pattern untuk two-way binding di base components
- Slot-based composition over prop-drilling untuk complex UI

## Store Rules

- Satu store per domain (collections, environments, history, tabs, settings)
- Actions untuk logic, getters untuk derived state
- Jangan mutate state langsung dari component — selalu lewat action
- Store boleh depend on store lain (import & use), tapi hindari circular

## Composable Rules

- Prefix `use` wajib
- Return reactive refs/computed, bukan raw values
- Side effects (file I/O, HTTP) harus di-handle di composable, bukan di component langsung
- Error handling di level composable, expose error state ke component

## Styling Rules

- Tailwind first — custom CSS hanya kalau Tailwind nggak bisa
- Dark mode: gunakan `dark:` variant (class-based strategy)
- Spacing: gunakan Tailwind scale, jangan hardcode px
- Colors: definisikan semantic color tokens di Tailwind config (e.g., `bg-surface`, `text-primary`, `border-muted`)
- Transitions: gunakan Tailwind transition utilities
- Responsive: app ini desktop-first (Tauri), tapi tetap gunakan logical sizing

## File Organization

```
src/
├── components/base/    # Generic, reusable UI components
├── features/           # Feature-specific components grouped by domain
├── composables/        # Shared reactive logic
├── stores/             # Pinia stores
├── types/              # TypeScript type definitions
├── utils/              # Pure utility functions (no Vue reactivity)
├── layouts/            # App layout shells
└── assets/styles/      # Global styles, Tailwind config
```

## Import Order

```ts
// 1. Vue/core
import { ref, computed } from 'vue'

// 2. Third-party libraries
import { storeToRefs } from 'pinia'

// 3. Stores
import { useCollectionsStore } from '@/stores/collections'

// 4. Composables
import { useHttp } from '@/composables/useHttp'

// 5. Components
import BaseButton from '@/components/base/BaseButton.vue'

// 6. Types
import type { RequestConfig } from '@/types/request'

// 7. Utils/constants
import { formatBytes } from '@/utils/formatters'
```

## Error Handling

- Semua async operation harus di-wrap try/catch
- User-facing errors → expose via reactive state, tampilkan di UI
- Internal errors → console.error + optional telemetry later
- Jangan silent-fail — minimal log ke console

## Performance

- Gunakan `shallowRef` untuk large objects yang jarang berubah deeply
- Lazy-load feature panels yang tidak visible
- Debounce input yang trigger expensive operations (search, env variable resolution)
- `v-once` untuk static content

## Anti-patterns

The following patterns are prohibited:

- Creating duplicate components or composables.
- Mutating Pinia state outside store actions.
- Calling Tauri plugins directly from Vue components.
- Using browser `fetch()` or introducing `axios`.
- Using `localStorage` for persistence.
- Bypassing `useHttp()` or `useStorage()`.

## Architecture Rules

Before creating a new:

- component
- composable
- utility
- store

Always search for an existing implementation first.

Prefer extending existing modules over creating parallel ones.

Do not redesign the architecture unless explicitly requested.

## Implementation Workflow

For non-trivial tasks:

1. Identify the affected modules.
2. Reuse existing code whenever possible.
3. Explain the implementation plan before making architectural changes.
4. Keep changes localized.

## Decision Making

When multiple implementations are possible:

1. Reuse existing code.
2. Prefer consistency over novelty.
3. Prefer extending existing modules.
4. Minimize new files.
5. Minimize public API changes.
6. Preserve existing architecture.

## Code Quality

- Keep functions focused on a single responsibility.
- Prefer composition over inheritance.
- Prefer explicit code over clever abstractions.
- Remove dead code instead of leaving commented code.
- Avoid premature optimization.

## Existing Code First

Before writing any code:

1. Search the existing codebase.
2. Prefer modifying existing files over creating new ones.
3. Create a new file only when there is no appropriate place for the implementation.
4. Avoid introducing duplicate abstractions.

## Comments

- Do not add comments that describe obvious code.
- Prefer self-explanatory code.
- Add comments only to explain non-obvious business logic or architectural decisions.
- Remove outdated comments when modifying code.

## Git & Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- Satu commit = satu logical change
- Branch naming: `feat/feature-name`, `fix/bug-description`
