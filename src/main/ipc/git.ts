import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getLoginShellEnv } from '../shell-env'
import { isValidDir } from './repos'

const execFileAsync = promisify(execFile)

export interface GitStatus {
  isRepo: boolean
  branch?: string
  changedFiles?: number
  ahead?: number
  hasUpstream?: boolean
  clean?: boolean
}

export interface GitResult {
  ok: boolean
  output?: string
  error?: string
}

async function git(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = await getLoginShellEnv()
  return execFileAsync('git', args, {
    cwd: repoPath,
    env: env as { [key: string]: string },
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024
  })
}

function errText(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { stderr?: string; message?: string }
    const stderr = e.stderr?.trim()
    if (stderr) return stderr
    if (e.message) return e.message
  }
  return String(err)
}

export function registerGitHandlers(): void {
  ipcMain.handle('git:status', async (_e, repoPath: string): Promise<GitStatus> => {
    if (!isValidDir(repoPath)) return { isRepo: false }
    try {
      const { stdout: inside } = await git(repoPath, ['rev-parse', '--is-inside-work-tree'])
      if (inside.trim() !== 'true') return { isRepo: false }

      const { stdout: branch } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
      const { stdout: porcelain } = await git(repoPath, ['status', '--porcelain'])
      const changedFiles = porcelain.split('\n').filter((l) => l.trim().length > 0).length

      let ahead = 0
      let hasUpstream = false
      try {
        const { stdout } = await git(repoPath, ['rev-list', '--count', '@{u}..HEAD'])
        ahead = parseInt(stdout.trim(), 10) || 0
        hasUpstream = true
      } catch {
        hasUpstream = false
      }

      return {
        isRepo: true,
        branch: branch.trim(),
        changedFiles,
        ahead,
        hasUpstream,
        clean: changedFiles === 0
      }
    } catch {
      return { isRepo: false }
    }
  })

  ipcMain.handle(
    'git:commit',
    async (_e, repoPath: string, subject: string, description?: string): Promise<GitResult> => {
      if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
      if (!subject?.trim()) return { ok: false, error: 'Commit message is required' }
      try {
        await git(repoPath, ['add', '-A'])
        const args = ['commit', '-m', subject.trim()]
        if (description?.trim()) args.push('-m', description.trim())
        const { stdout } = await git(repoPath, args)
        return { ok: true, output: stdout.trim() }
      } catch (err) {
        return { ok: false, error: errText(err) }
      }
    }
  )

  ipcMain.handle('git:push', async (_e, repoPath: string): Promise<GitResult> => {
    if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
    try {
      // Set upstream automatically on first push of a new branch.
      const { stdout: branch } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
      let args = ['push']
      try {
        await git(repoPath, ['rev-parse', '--abbrev-ref', '@{u}'])
      } catch {
        args = ['push', '-u', 'origin', branch.trim()]
      }
      const { stdout, stderr } = await git(repoPath, args)
      return { ok: true, output: `${stdout}${stderr}`.trim() }
    } catch (err) {
      return { ok: false, error: errText(err) }
    }
  })
}
