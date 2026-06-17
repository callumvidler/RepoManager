import { useEffect, useRef, useState } from 'react'
import { Tag, ChevronDown, Loader2, Rocket, AlertCircle, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReleaseType, RepoRecord, WorkflowInfo } from '../../../preload/index'

interface Props {
  repo: RepoRecord
  onReleased: (ok: boolean, message: string) => void
}

const BUMPS: { type: ReleaseType; label: string; hint: string }[] = [
  { type: 'patch', label: 'Patch', hint: 'bug fixes' },
  { type: 'minor', label: 'Minor', hint: 'new features' },
  { type: 'major', label: 'Major', hint: 'breaking changes' }
]

// Bump a semver string for previewing the resulting version in the menu.
function nextVersion(current: string, type: ReleaseType): string | null {
  const m = current.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (type === 'major') [major, minor, patch] = [major + 1, 0, 0]
  else if (type === 'minor') [minor, patch] = [minor + 1, 0]
  else patch += 1
  return `${major}.${minor}.${patch}`
}

export function ReleaseSwitcher({ repo, onReleased }: Props): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<ReleaseType | null>(null)
  const [current, setCurrent] = useState<string | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const [isNode, setIsNode] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([])
  const [wfError, setWfError] = useState<string | null>(null)
  const [wfLoading, setWfLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Load the current version up front so the button can render it.
  useEffect(() => {
    let cancelled = false
    void window.api.git.versions(repo.path).then((res) => {
      if (cancelled) return
      setCurrent(res.current)
      setTags(res.tags)
      setIsNode(res.isNodeProject)
    })
    return () => {
      cancelled = true
    }
  }, [repo.path])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const res = await window.api.git.versions(repo.path)
    setCurrent(res.current)
    setTags(res.tags)
    setIsNode(res.isNodeProject)
    setLoading(false)
  }

  const loadWorkflows = async (): Promise<void> => {
    setWfLoading(true)
    setWfError(null)
    const res = await window.api.git.workflows(repo.path)
    setWorkflows(res.workflows)
    setWfError(res.ok ? null : (res.error ?? 'Could not list workflows'))
    setWfLoading(false)
  }

  const toggle = (): void => {
    const next = !open
    setOpen(next)
    if (next) {
      void load()
      void loadWorkflows()
    }
  }

  const rebuild = async (wf: WorkflowInfo): Promise<void> => {
    setRebuilding(wf.id)
    setError(null)
    // Re-point the current version's tag at the latest commit and rebuild from it,
    // keeping the version number the same (the main process moves & force-pushes
    // the tag). Reuse the existing tag's exact name if present, else default to a
    // v-prefixed tag. With no current version, fall back to the current branch.
    const tag = current
      ? (tags.find((t) => t.replace(/^v/, '') === current) ?? `v${current}`)
      : undefined
    const res = await window.api.git.dispatchBuild(repo.path, wf.id, tag)
    setRebuilding(null)
    if (res.ok) {
      setOpen(false)
      onReleased(true, `Rebuild triggered${current ? ` for v${current}` : ''}`)
    } else {
      setError(res.error ?? 'Rebuild failed')
      onReleased(false, res.error ?? 'Rebuild failed')
    }
  }

  const bump = async (type: ReleaseType): Promise<void> => {
    setBusy(type)
    setError(null)
    const res = await window.api.git.bumpVersion(repo.path, type)
    setBusy(null)
    if (res.ok) {
      setOpen(false)
      await load()
      onReleased(true, `Released ${res.tag} — build triggered`)
    } else {
      setError(res.error ?? 'Release failed')
      onReleased(false, res.error ?? 'Release failed')
    }
  }

  // Not a Node project — nothing to version.
  if (!isNode) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        disabled={busy !== null}
        title="Bump version & trigger build"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Tag className="size-3.5" />}
        <span className="max-w-[140px] truncate">{current ? `v${current}` : '…'}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Versions
          </div>

          <div className="max-h-48 overflow-y-auto py-1">
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>}
            {!loading && current && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Tag className="size-3.5 shrink-0 text-emerald-500" />
                <span className="font-medium">v{current}</span>
                <span className="rounded bg-accent px-1 text-[10px] text-accent-foreground">
                  current
                </span>
              </div>
            )}
            {!loading &&
              tags
                .filter((t) => t.replace(/^v/, '') !== current)
                .map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    <Tag className="size-3.5 shrink-0 opacity-50" />
                    <span className="truncate">{t}</span>
                  </div>
                ))}
            {!loading && tags.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No published tags yet</div>
            )}
          </div>

          <div className="border-t p-1">
            <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Release a new version
            </div>
            {BUMPS.map(({ type, label, hint }) => {
              const preview = current ? nextVersion(current, type) : null
              return (
                <button
                  key={type}
                  onClick={() => bump(type)}
                  disabled={busy !== null || rebuilding !== null}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                >
                  {busy === type ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5 shrink-0" />
                  )}
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{hint}</span>
                  {preview && (
                    <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      v{preview}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="border-t p-1">
            <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Rebuild without bumping
            </div>
            {wfLoading && <div className="px-3 py-1.5 text-xs text-muted-foreground">Loading…</div>}
            {!wfLoading && wfError && (
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground">{wfError}</div>
            )}
            {!wfLoading && !wfError && workflows.length === 0 && (
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                No GitHub Actions workflows found
              </div>
            )}
            {!wfLoading &&
              !wfError &&
              workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => rebuild(wf)}
                  disabled={busy !== null || rebuilding !== null}
                  title={`Re-run "${wf.name}"${current ? ` for v${current}` : ''} without a version bump`}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                >
                  {rebuilding === wf.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <RotateCw className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{wf.name}</span>
                  {current && (
                    <span className="ml-auto rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                      v{current}
                    </span>
                  )}
                </button>
              ))}
          </div>

          {error && (
            <div className="flex items-start gap-1.5 border-t bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 size-3 shrink-0" /> {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
