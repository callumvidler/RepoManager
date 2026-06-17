import { useEffect, useRef, useState } from 'react'
import { GitBranch, ChevronDown, Plus, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RepoRecord } from '../../../preload/index'

interface Props {
  repo: RepoRecord
  currentBranch?: string
  onChanged: (ok: boolean, message: string) => void
}

export function BranchSwitcher({ repo, currentBranch, onChanged }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [current, setCurrent] = useState(currentBranch)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setCurrent(currentBranch), [currentBranch])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const load = async (): Promise<void> => {
    setLoading(true)
    const res = await window.api.git.branches(repo.path)
    setBranches(res.branches)
    if (res.current) setCurrent(res.current)
    setLoading(false)
  }

  const toggle = (): void => {
    const next = !open
    setOpen(next)
    setCreating(false)
    if (next) void load()
  }

  const checkout = async (branch: string): Promise<void> => {
    if (branch === current) {
      setOpen(false)
      return
    }
    setBusy(true)
    const res = await window.api.git.checkout(repo.path, branch)
    setBusy(false)
    setOpen(false)
    onChanged(res.ok, res.ok ? `Switched to ${branch}` : (res.error ?? 'Checkout failed'))
  }

  const create = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    const res = await window.api.git.createBranch(repo.path, name)
    setBusy(false)
    setOpen(false)
    setCreating(false)
    setNewName('')
    onChanged(res.ok, res.ok ? `Created ${name}` : (res.error ?? 'Create failed'))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        disabled={busy}
        title="Switch branch"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
        <span className="max-w-[140px] truncate">{current ?? '…'}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>}
            {!loading && branches.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No branches found</div>
            )}
            {!loading &&
              branches.map((b) => (
                <button
                  key={b}
                  onClick={() => checkout(b)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <Check
                    className={cn('size-3.5 shrink-0', b === current ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{b}</span>
                </button>
              ))}
          </div>

          <div className="border-t p-1">
            {creating ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void create()
                    else if (e.key === 'Escape') {
                      setCreating(false)
                      setNewName('')
                    }
                  }}
                  placeholder="new-branch-name"
                  className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={create}
                  disabled={!newName.trim()}
                  className="shrink-0 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <Plus className="size-3.5" /> New branch…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
