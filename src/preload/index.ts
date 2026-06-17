import { contextBridge, ipcRenderer } from 'electron'

export interface RepoRecord {
  id: string
  path: string
  name: string
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun'
  runCommand?: string
  addedAt: number
}

export interface DetectionResult {
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun'
  runCommand?: string
  scripts: Record<string, string>
  isNodeProject: boolean
}

export interface PtyExit {
  ptyId: string
  exitCode: number
  signal?: number
}

const api = {
  repos: {
    list: (): Promise<RepoRecord[]> => ipcRenderer.invoke('repos:list'),
    add: (): Promise<RepoRecord | null> => ipcRenderer.invoke('repos:add'),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('repos:remove', id),
    setRunCommand: (id: string, runCommand: string): Promise<RepoRecord | undefined> =>
      ipcRenderer.invoke('repos:setRunCommand', id, runCommand),
    detect: (repoPath: string): Promise<DetectionResult> =>
      ipcRenderer.invoke('repos:detect', repoPath),
    reveal: (repoPath: string): Promise<void> => ipcRenderer.invoke('repos:reveal', repoPath),
    exists: (repoPath: string): Promise<boolean> => ipcRenderer.invoke('repos:exists', repoPath)
  },
  pty: {
    spawn: (opts: {
      ptyId: string
      repoPath: string
      command?: string
      cols: number
      rows: number
    }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('pty:spawn', opts),
    input: (ptyId: string, data: string): void =>
      ipcRenderer.send('pty:input', { ptyId, data }),
    resize: (ptyId: string, cols: number, rows: number): void =>
      ipcRenderer.send('pty:resize', { ptyId, cols, rows }),
    kill: (ptyId: string): void => ipcRenderer.send('pty:kill', { ptyId }),
    onData: (cb: (payload: { ptyId: string; data: string }) => void): (() => void) => {
      const handler = (_e: unknown, payload: { ptyId: string; data: string }): void => cb(payload)
      ipcRenderer.on('pty:data', handler)
      return () => ipcRenderer.removeListener('pty:data', handler)
    },
    onExit: (cb: (payload: PtyExit) => void): (() => void) => {
      const handler = (_e: unknown, payload: PtyExit): void => cb(payload)
      ipcRenderer.on('pty:exit', handler)
      return () => ipcRenderer.removeListener('pty:exit', handler)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
