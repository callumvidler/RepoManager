import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface SettingsState {
  theme: ThemeMode
  terminalFontSize: number
  terminalFontFamily: string
  /** Auto-start a Claude Code panel the first time a repo is opened. */
  autoStartClaude: boolean
  /** Command spawned for new Claude panels. */
  claudeCommand: string

  setTheme: (theme: ThemeMode) => void
  setTerminalFontSize: (size: number) => void
  setTerminalFontFamily: (family: string) => void
  setAutoStartClaude: (value: boolean) => void
  setClaudeCommand: (command: string) => void
  reset: () => void
}

export const DEFAULT_SETTINGS = {
  theme: 'dark' as ThemeMode,
  terminalFontSize: 13,
  terminalFontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  autoStartClaude: true,
  claudeCommand: 'claude'
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
      reset: () => set({ ...DEFAULT_SETTINGS })
    }),
    { name: 'repo-manager-settings' }
  )
)
