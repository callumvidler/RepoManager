import { ipcMain, BrowserWindow, type WebContents } from 'electron'
import * as pty from 'node-pty'
import { getLoginShellEnv } from '../shell-env'
import { isValidDir } from './repos'

interface SpawnOptions {
  ptyId: string
  repoPath: string
  /** Command to run inside the login shell, e.g. "claude" or "pnpm dev". Empty = plain shell. */
  command?: string
  cols: number
  rows: number
}

interface PtySession {
  proc: pty.IPty
  sender: WebContents
}

const sessions = new Map<string, PtySession>()

function send(sender: WebContents, channel: string, payload: unknown): void {
  if (!sender.isDestroyed()) sender.send(channel, payload)
}

export function registerPtyHandlers(): void {
  ipcMain.handle('pty:spawn', async (event, opts: SpawnOptions): Promise<{ ok: boolean; error?: string }> => {
    const { ptyId, repoPath, command, cols, rows } = opts

    if (!isValidDir(repoPath)) {
      return { ok: false, error: `Folder not found: ${repoPath}` }
    }
    // Replace any stale session with the same id.
    killSession(ptyId)

    const env = await getLoginShellEnv()
    const shell = env.SHELL || process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')

    // `-l -i` so nvm/PATH and shell functions (like the `claude` launcher) resolve.
    // `-c <command>` runs the command, then we keep the shell interactive is not
    // possible with a single -c, so for a command we exec it; for a plain shell we
    // just start interactive.
    const args =
      process.platform === 'win32'
        ? []
        : command
          ? ['-lic', command]
          : ['-li']

    try {
      const proc = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: Math.max(cols, 2),
        rows: Math.max(rows, 1),
        cwd: repoPath,
        env: env as { [key: string]: string }
      })

      const sender = event.sender
      sessions.set(ptyId, { proc, sender })

      proc.onData((data) => send(sender, 'pty:data', { ptyId, data }))
      proc.onExit(({ exitCode, signal }) => {
        send(sender, 'pty:exit', { ptyId, exitCode, signal })
        sessions.delete(ptyId)
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.on('pty:input', (_event, { ptyId, data }: { ptyId: string; data: string }) => {
    sessions.get(ptyId)?.proc.write(data)
  })

  ipcMain.on(
    'pty:resize',
    (_event, { ptyId, cols, rows }: { ptyId: string; cols: number; rows: number }) => {
      const session = sessions.get(ptyId)
      if (!session) return
      try {
        session.proc.resize(Math.max(cols, 2), Math.max(rows, 1))
      } catch {
        /* resize can throw if the pty just exited — ignore */
      }
    }
  )

  ipcMain.on('pty:kill', (_event, { ptyId }: { ptyId: string }) => {
    killSession(ptyId)
  })
}

function killSession(ptyId: string): void {
  const session = sessions.get(ptyId)
  if (!session) return
  try {
    session.proc.kill()
  } catch {
    /* already dead */
  }
  sessions.delete(ptyId)
}

/** Kill every PTY — called on app quit so no orphaned claude/dev-server processes linger. */
export function killAllPtys(): void {
  for (const id of [...sessions.keys()]) killSession(id)
}

/** Remove sessions belonging to a destroyed window. */
export function cleanupWindow(win: BrowserWindow): void {
  for (const [id, session] of sessions) {
    if (session.sender === win.webContents) killSession(id)
  }
}
