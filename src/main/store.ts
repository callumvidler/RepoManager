import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { basename } from 'path'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface RepoRecord {
  id: string
  path: string
  name: string
  packageManager?: PackageManager
  /** User override for the run command. Falls back to detection when empty. */
  runCommand?: string
  addedAt: number
}

interface StoreShape {
  repos: RepoRecord[]
}

const store = new Store<StoreShape>({
  name: 'repo-manager',
  defaults: { repos: [] }
})

export function listRepos(): RepoRecord[] {
  return store.get('repos', [])
}

export function addRepo(path: string): RepoRecord {
  const repos = listRepos()
  const existing = repos.find((r) => r.path === path)
  if (existing) return existing

  const record: RepoRecord = {
    id: randomUUID(),
    path,
    name: basename(path),
    addedAt: Date.now()
  }
  store.set('repos', [...repos, record])
  return record
}

export function removeRepo(id: string): void {
  store.set(
    'repos',
    listRepos().filter((r) => r.id !== id)
  )
}

export function updateRepo(id: string, patch: Partial<RepoRecord>): RepoRecord | undefined {
  const repos = listRepos()
  let updated: RepoRecord | undefined
  const next = repos.map((r) => {
    if (r.id !== id) return r
    updated = { ...r, ...patch, id: r.id, path: r.path }
    return updated
  })
  if (updated) store.set('repos', next)
  return updated
}
