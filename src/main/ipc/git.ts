import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'
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

export interface GitBranches {
  branches: string[]
  current?: string
}

export type ReleaseType = 'patch' | 'minor' | 'major'

export interface GitVersions {
  current?: string
  tags: string[]
  isNodeProject: boolean
}

export interface BumpResult extends GitResult {
  version?: string
  tag?: string
}

export interface WorkflowInfo {
  id: string
  name: string
  path: string
}

export interface WorkflowList {
  ok: boolean
  workflows: WorkflowInfo[]
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

async function readPackageVersion(repoPath: string): Promise<string | undefined> {
  try {
    const raw = await readFile(join(repoPath, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : undefined
  } catch {
    return undefined
  }
}

export function nextVersion(current: string, type: ReleaseType): string | null {
  // Strip a leading "v" and any pre-release/build metadata, then bump.
  const m = current.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (type === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (type === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
  return `${major}.${minor}.${patch}`
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

  ipcMain.handle('git:branches', async (_e, repoPath: string): Promise<GitBranches> => {
    if (!isValidDir(repoPath)) return { branches: [] }
    try {
      const { stdout } = await git(repoPath, ['branch', '--format=%(refname:short)'])
      const branches = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      const { stdout: cur } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
      return { branches, current: cur.trim() }
    } catch {
      return { branches: [] }
    }
  })

  ipcMain.handle('git:checkout', async (_e, repoPath: string, branch: string): Promise<GitResult> => {
    if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
    if (!branch?.trim()) return { ok: false, error: 'Branch name is required' }
    try {
      const { stdout, stderr } = await git(repoPath, ['checkout', branch.trim()])
      return { ok: true, output: `${stdout}${stderr}`.trim() }
    } catch (err) {
      return { ok: false, error: errText(err) }
    }
  })

  ipcMain.handle(
    'git:createBranch',
    async (_e, repoPath: string, name: string): Promise<GitResult> => {
      if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
      if (!name?.trim()) return { ok: false, error: 'Branch name is required' }
      try {
        const { stdout, stderr } = await git(repoPath, ['checkout', '-b', name.trim()])
        return { ok: true, output: `${stdout}${stderr}`.trim() }
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

  ipcMain.handle('git:versions', async (_e, repoPath: string): Promise<GitVersions> => {
    if (!isValidDir(repoPath)) return { tags: [], isNodeProject: false }
    const current = await readPackageVersion(repoPath)
    let tags: string[] = []
    try {
      // Version-like tags, newest first.
      const { stdout } = await git(repoPath, [
        'tag',
        '--list',
        '--sort=-version:refname',
        'v[0-9]*',
        '[0-9]*'
      ])
      tags = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    } catch {
      tags = []
    }
    return { current, tags, isNodeProject: current !== undefined }
  })

  ipcMain.handle(
    'git:bumpVersion',
    async (_e, repoPath: string, type: ReleaseType): Promise<BumpResult> => {
      if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
      if (type !== 'patch' && type !== 'minor' && type !== 'major') {
        return { ok: false, error: 'Invalid release type' }
      }
      const current = await readPackageVersion(repoPath)
      if (current === undefined) {
        return { ok: false, error: 'No package.json with a version field found' }
      }
      try {
        const env = await getLoginShellEnv()
        // `npm version` bumps package.json, creates a commit and an annotated tag.
        // It requires a clean working tree, which keeps the release commit focused.
        const { stdout } = await execFileAsync(
          'npm',
          ['version', type, '-m', 'chore: release v%s'],
          {
            cwd: repoPath,
            env: env as { [key: string]: string },
            encoding: 'utf8',
            maxBuffer: 4 * 1024 * 1024
          }
        )
        const version = (await readPackageVersion(repoPath)) ?? stdout.trim().replace(/^v/, '')
        const tag = `v${version}`

        // Push the release commit (setting upstream if needed) and the new tag,
        // which is what triggers the repo's GitHub Actions build.
        const { stdout: branch } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
        let pushArgs = ['push']
        try {
          await git(repoPath, ['rev-parse', '--abbrev-ref', '@{u}'])
        } catch {
          pushArgs = ['push', '-u', 'origin', branch.trim()]
        }
        await git(repoPath, pushArgs)
        await git(repoPath, ['push', 'origin', tag])

        return { ok: true, version, tag, output: `Released ${tag} and pushed` }
      } catch (err) {
        return { ok: false, error: errText(err) }
      }
    }
  )

  ipcMain.handle('git:workflows', async (_e, repoPath: string): Promise<WorkflowList> => {
    if (!isValidDir(repoPath)) return { ok: false, workflows: [], error: 'Folder not found' }
    try {
      const env = await getLoginShellEnv()
      const { stdout } = await execFileAsync(
        'gh',
        ['workflow', 'list', '--json', 'id,name,path,state'],
        { cwd: repoPath, env: env as { [key: string]: string }, encoding: 'utf8' }
      )
      const raw = JSON.parse(stdout) as { id: number | string; name: string; path: string; state: string }[]
      const workflows = raw
        .filter((w) => w.state === 'active')
        .map((w) => ({ id: String(w.id), name: w.name, path: w.path }))
      return { ok: true, workflows }
    } catch (err) {
      return { ok: false, workflows: [], error: errText(err) }
    }
  })

  ipcMain.handle(
    'git:dispatchBuild',
    async (_e, repoPath: string, workflowId: string, ref?: string): Promise<GitResult> => {
      if (!isValidDir(repoPath)) return { ok: false, error: 'Folder not found' }
      if (!workflowId?.trim()) return { ok: false, error: 'Workflow is required' }
      try {
        const env = await getLoginShellEnv()
        let targetRef = ref?.trim()
        if (targetRef) {
          // A version tag was given (a "rebuild without bumping"). Move the tag to
          // the current HEAD and force-push it, so the rebuild runs the latest
          // pushed code while keeping the version number the same. GitHub reads
          // both the workflow file and the checked-out source from this ref, so
          // the tag must point at the commit we actually want to build.
          await git(repoPath, ['tag', '-f', targetRef])
          await git(repoPath, ['push', '-f', 'origin', targetRef])
        } else {
          // No tag — build the current branch tip.
          const { stdout } = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
          targetRef = stdout.trim()
        }
        const { stdout, stderr } = await execFileAsync(
          'gh',
          ['workflow', 'run', workflowId.trim(), '--ref', targetRef],
          { cwd: repoPath, env: env as { [key: string]: string }, encoding: 'utf8' }
        )
        return { ok: true, output: `${stdout}${stderr}`.trim() || `Build triggered on ${targetRef}` }
      } catch (err) {
        return { ok: false, error: errText(err) }
      }
    }
  )
}
