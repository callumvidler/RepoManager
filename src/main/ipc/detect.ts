import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { PackageManager } from '../store'

export interface DetectionResult {
  packageManager?: PackageManager
  /** Suggested full run command, e.g. "pnpm dev". Undefined if nothing detected. */
  runCommand?: string
  /** All npm scripts found, so the UI can offer alternatives. */
  scripts: Record<string, string>
  isNodeProject: boolean
}

function detectPackageManager(repoPath: string): PackageManager {
  if (existsSync(join(repoPath, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(repoPath, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(repoPath, 'bun.lockb')) || existsSync(join(repoPath, 'bun.lock'))) return 'bun'
  return 'npm'
}

function runScript(pm: PackageManager, script: string): string {
  // npm needs `run`; the others accept the script name directly but `run` works too.
  return pm === 'npm' ? `npm run ${script}` : `${pm} run ${script}`
}

export function detectRunCommand(repoPath: string): DetectionResult {
  const pkgPath = join(repoPath, 'package.json')
  if (!existsSync(pkgPath)) {
    return { scripts: {}, isNodeProject: false }
  }

  let scripts: Record<string, string> = {}
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {}
  } catch {
    return { scripts: {}, isNodeProject: true }
  }

  const pm = detectPackageManager(repoPath)

  // Prefer `dev`, then `start`, then the first available script.
  let chosen: string | undefined
  if (scripts.dev) chosen = 'dev'
  else if (scripts.start) chosen = 'start'
  else chosen = Object.keys(scripts)[0]

  return {
    packageManager: pm,
    runCommand: chosen ? runScript(pm, chosen) : undefined,
    scripts,
    isNodeProject: true
  }
}
