import { create } from 'zustand'
import type { RepoRecord } from '../../../preload/index'
import { useSettingsStore } from './useSettingsStore'

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
    command: config?.command?.trim() || useSettingsStore.getState().claudeCommand
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

  setRepos: (repos: RepoRecord[]) => void
  upsertRepo: (repo: RepoRecord) => void
  removeRepo: (id: string) => void
  selectRepo: (id: string | null) => void

  panelsFor: (repoId: string) => ClaudePanel[]
  addPanel: (repoId: string, config?: PanelConfig) => void
  removePanel: (repoId: string, panelId: string) => void
  renamePanel: (repoId: string, panelId: string, title: string) => void
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
      return {
        repos,
        panelsByRepo,
        openedRepoIds: state.openedRepoIds.filter((rid) => rid !== id),
        selectedRepoId:
          state.selectedRepoId === id ? (repos[0]?.id ?? null) : state.selectedRepoId
      }
    }),

  selectRepo: (id) => set((state) => ({ selectedRepoId: id, ...openRepo(state, id) })),

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
        panelsByRepo: { ...state.panelsByRepo, [repoId]: current.filter((p) => p.id !== panelId) }
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
    })
}))
