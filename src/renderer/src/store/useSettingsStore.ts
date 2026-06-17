import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Effort, PermissionMode } from '@/lib/claude'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface SettingsState {
  theme: ThemeMode
  terminalFontSize: number
  terminalFontFamily: string
  /** Auto-start a Claude Code panel the first time a repo is opened. */
  autoStartClaude: boolean
  /** Base command spawned for new Claude panels. */
  claudeCommand: string
  /** Default launch options applied to new Claude panels. */
  defaultModel: string
  defaultPermissionMode: PermissionMode
  defaultEffort: Effort

  setTheme: (theme: ThemeMode) => void
  setTerminalFontSize: (size: number) => void
  setTerminalFontFamily: (family: string) => void
  setAutoStartClaude: (value: boolean) => void
  setClaudeCommand: (command: string) => void
  setDefaultModel: (model: string) => void
  setDefaultPermissionMode: (mode: PermissionMode) => void
  setDefaultEffort: (effort: Effort) => void
  reset: () => void
}

export const DEFAULT_SETTINGS = {
  theme: 'dark' as ThemeMode,
  terminalFontSize: 13,
  terminalFontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  autoStartClaude: true,
  claudeCommand: 'claude',
  defaultModel: '',
  defaultPermissionMode: 'default' as PermissionMode,
  defaultEffort: '' as Effort
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setTerminalFontSize: (terminalFontSize) =>
        set({ terminalFontSize: Math.min(Math.max(terminalFontSize, 8), 32) }),
      setTerminalFontFamily: (terminalFontFamily) => set({ terminalFontFamily }),
      setAutoStartClaude: (autoStartClaude) => set({ autoStartClaude }),
      setClaudeCommand: (claudeCommand) => set({ claudeCommand }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setDefaultPermissionMode: (defaultPermissionMode) => set({ defaultPermissionMode }),
      setDefaultEffort: (defaultEffort) => set({ defaultEffort }),
      reset: () => set({ ...DEFAULT_SETTINGS })
    }),
    { name: 'repo-manager-settings' }
  )
)
