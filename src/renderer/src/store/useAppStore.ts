import { create } from 'zustand'
import type { RepoRecord } from '../../../preload/index'
import { useSettingsStore } from './useSettingsStore'
import { buildClaudeCommand } from '@/lib/claude'

/** Default command for auto-started panels, applying the user's saved Claude defaults. */
function defaultClaudeCommand(): string {
  const s = useSettingsStore.getState()
  return buildClaudeCommand(s.claudeCommand, {
    model: s.defaultModel,
    permissionMode: s.defaultPermissionMode,
    effort: s.defaultEffort
  })
}

let panelCounter = 0
function nextPanelId(): string {
  panelCounter += 1
  return `panel-${Date.now().toString(36)}-${panelCounter}`
}

export interface PanelConfig {
  title?: string
  command?: string
}

function makePanel(index: number, config?: PanelConfig): ClaudePanel {
  // Capture the command at creation so changing the setting later doesn't
  // disrupt already-running panels.
  return {
    id: nextPanelId(),
    title: config?.title?.trim() || `Claude ${index}`,
    command: config?.command?.trim() || defaultClaudeCommand()
  }
}

export interface ClaudePanel {
  id: string
  title: string
  command: string
}

interface AppState {
  repos: RepoRecord[]
  selectedRepoId: string | null
  /** Repos that have been opened at least once — their terminals stay mounted. */
  openedRepoIds: string[]
  /** Claude panels per repo id. */
  panelsByRepo: Record<string, ClaudePanel[]>
  /**
   * Panels whose Claude session is waiting for the user (signalled by a terminal
   * bell). Keyed by panel id. Drives the panel highlight and the sidebar badge.
   */
  attentionPanels: Record<string, boolean>

  setRepos: (repos: RepoRecord[]) => void
  upsertRepo: (repo: RepoRecord) => void
  removeRepo: (id: string) => void
  selectRepo: (id: string | null) => void

  panelsFor: (repoId: string) => ClaudePanel[]
  addPanel: (repoId: string, config?: PanelConfig) => void
  removePanel: (repoId: string, panelId: string) => void
  renamePanel: (repoId: string, panelId: string, title: string) => void

  /** Flag a panel as awaiting the user (terminal bell received). */
  markAttention: (panelId: string) => void
  /** Clear a single panel's waiting flag (user engaged with it). */
  clearAttention: (panelId: string) => void
  /** Clear the waiting flag for every panel belonging to a repo. */
  clearRepoAttention: (repoId: string) => void
  /** True when any of the repo's panels is waiting for the user. */
  repoHasAttention: (repoId: string) => boolean
}

/**
 * Mark a repo as opened. On its first open we auto-start a Claude Code panel so
 * selecting a repo immediately gives the user a live `claude` session.
 */
function openRepo(
  state: AppState,
  id: string | null
): Pick<AppState, 'openedRepoIds' | 'panelsByRepo'> {
  if (!id || state.openedRepoIds.includes(id)) {
    return { openedRepoIds: state.openedRepoIds, panelsByRepo: state.panelsByRepo }
  }
  const existing = state.panelsByRepo[id] ?? []
  const autoStart = useSettingsStore.getState().autoStartClaude
  const panelsByRepo =
    autoStart && existing.length === 0
      ? { ...state.panelsByRepo, [id]: [makePanel(1)] }
      : state.panelsByRepo
  return { openedRepoIds: [...state.openedRepoIds, id], panelsByRepo }
}

export const useAppStore = create<AppState>((set, get) => ({
  repos: [],
  selectedRepoId: null,
  openedRepoIds: [],
  panelsByRepo: {},
  attentionPanels: {},

  setRepos: (repos) =>
    set((state) => {
      const selectedRepoId =
        state.selectedRepoId && repos.some((r) => r.id === state.selectedRepoId)
          ? state.selectedRepoId
          : (repos[0]?.id ?? null)
      return { repos, selectedRepoId, ...openRepo({ ...state }, selectedRepoId) }
    }),

  upsertRepo: (repo) =>
    set((state) => {
      const exists = state.repos.some((r) => r.id === repo.id)
      return {
        repos: exists
          ? state.repos.map((r) => (r.id === repo.id ? repo : r))
          : [...state.repos, repo]
      }
    }),

  removeRepo: (id) =>
    set((state) => {
      const repos = state.repos.filter((r) => r.id !== id)
      const { [id]: _removed, ...panelsByRepo } = state.panelsByRepo
      const removedPanelIds = (state.panelsByRepo[id] ?? []).map((p) => p.id)
      const attentionPanels = removedPanelIds.length
        ? omitKeys(state.attentionPanels, removedPanelIds)
        : state.attentionPanels
      return {
        repos,
        panelsByRepo,
        attentionPanels,
        openedRepoIds: state.openedRepoIds.filter((rid) => rid !== id),
        selectedRepoId:
          state.selectedRepoId === id ? (repos[0]?.id ?? null) : state.selectedRepoId
      }
    }),

  selectRepo: (id) =>
    set((state) => {
      // Viewing a repo clears its pending alerts — you're now looking at it.
      const attentionPanels = id
        ? omitKeys(
            state.attentionPanels,
            (state.panelsByRepo[id] ?? []).map((p) => p.id)
          )
        : state.attentionPanels
      return { selectedRepoId: id, attentionPanels, ...openRepo(state, id) }
    }),

  panelsFor: (repoId) => get().panelsByRepo[repoId] ?? [],

  addPanel: (repoId, config) =>
    set((state) => {
      const current = state.panelsByRepo[repoId] ?? []
      return {
        panelsByRepo: {
          ...state.panelsByRepo,
          [repoId]: [...current, makePanel(current.length + 1, config)]
        }
      }
    }),

  removePanel: (repoId, panelId) =>
    set((state) => {
      const current = state.panelsByRepo[repoId] ?? []
      return {
        panelsByRepo: { ...state.panelsByRepo, [repoId]: current.filter((p) => p.id !== panelId) },
        attentionPanels: omitKeys(state.attentionPanels, [panelId])
      }
    }),

  renamePanel: (repoId, panelId, title) =>
    set((state) => {
      const current = state.panelsByRepo[repoId] ?? []
      return {
        panelsByRepo: {
          ...state.panelsByRepo,
          [repoId]: current.map((p) => (p.id === panelId ? { ...p, title } : p))
        }
      }
    }),

  markAttention: (panelId) =>
    set((state) =>
      state.attentionPanels[panelId]
        ? {}
        : { attentionPanels: { ...state.attentionPanels, [panelId]: true } }
    ),

  clearAttention: (panelId) =>
    set((state) =>
      state.attentionPanels[panelId]
        ? { attentionPanels: omitKeys(state.attentionPanels, [panelId]) }
        : {}
    ),

  clearRepoAttention: (repoId) =>
    set((state) => ({
      attentionPanels: omitKeys(
        state.attentionPanels,
        (state.panelsByRepo[repoId] ?? []).map((p) => p.id)
      )
    })),

  repoHasAttention: (repoId) => {
    const { attentionPanels, panelsByRepo } = get()
    return (panelsByRepo[repoId] ?? []).some((p) => attentionPanels[p.id])
  }
}))

/** Return a shallow copy of `obj` without the given keys. */
function omitKeys<T>(obj: Record<string, T>, keys: string[]): Record<string, T> {
  if (!keys.length) return obj
  const next = { ...obj }
  for (const key of keys) delete next[key]
  return next
}
