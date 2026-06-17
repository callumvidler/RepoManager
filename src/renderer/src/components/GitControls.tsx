import { useCallback, useEffect, useRef, useState } from 'react'
import { GitBranch, GitCommit, Upload, X, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BranchSwitcher } from './BranchSwitcher'
import { ReleaseSwitcher } from './ReleaseSwitcher'
import type { GitStatus, RepoRecord } from '../../../preload/index'

interface Props {
  repo: RepoRecord
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null

export function GitControls({ repo }: Props): React.JSX.Element | null {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commitOpen, setCommitOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const s = await window.api.git.status(repo.path)
    setStatus(s)
  }, [repo.path])

  useEffect(() => {
    void refresh()
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const flash = useCallback((fb: Feedback): void => {
    setFeedback(fb)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 5000)
  }, [])

  const push = useCallback(async (): Promise<void> => {
    setBusy(true)
    const res = await window.api.git.push(repo.path)
    setBusy(false)
    flash(res.ok ? { kind: 'ok', text: 'Pushed' } : { kind: 'error', text: res.error ?? 'Push failed' })
    void refresh()
  }, [repo.path, flash, refresh])

  // Not a git repo — nothing to show.
  if (status && !status.isRepo) return null

  return (
    <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {feedback && (
        <span
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
            feedback.kind === 'ok'
              ? 'bg-emerald-500/15 text-emerald-500'
              : 'bg-destructive/15 text-destructive'
          )}
        >
          {feedback.kind === 'ok' ? <Check className="size-3" /> : <AlertCircle className="size-3" />}
          {feedback.text}
        </span>
      )}

      {status?.isRepo && (
        <div className="flex items-center gap-1">
          <BranchSwitcher
            repo={repo}
            currentBranch={status.branch}
            onChanged={(ok, message) => {
              flash({ kind: ok ? 'ok' : 'error', text: message })
              void refresh()
            }}
          />
          {!!status.changedFiles && (
            <span className="rounded bg-accent px-1 text-[10px] text-accent-foreground">
              {status.changedFiles} changed
            </span>
          )}
          <ReleaseSwitcher
            repo={repo}
            onReleased={(ok, message) => {
              flash({ kind: ok ? 'ok' : 'error', text: message })
              void refresh()
            }}
          />
        </div>
      )}

      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          void refresh()
          setCommitOpen(true)
        }}
        disabled={busy}
      >
        <GitCommit className="size-3.5" /> Commit
      </Button>

      <Button size="sm" variant="secondary" onClick={push} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        Push
        {!!status?.ahead && (
          <span className="ml-0.5 rounded bg-background/40 px-1 text-[10px]">{status.ahead}</span>
        )}
      </Button>

      {commitOpen && (
        <CommitDialog
          repo={repo}
          status={status}
          onClose={() => setCommitOpen(false)}
          onDone={(fb) => {
            flash(fb)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function CommitDialog({
  repo,
  status,
  onClose,
  onDone
}: {
  repo: RepoRecord
  status: GitStatus | null
  onClose: () => void
  onDone: (fb: Feedback) => void
}): React.JSX.Element {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const nothingToCommit = status?.isRepo && status.clean

  const run = async (alsoPush: boolean): Promise<void> => {
    if (!subject.trim()) {
      setError('Commit message is required')
      return
    }
    setBusy(true)
    setError(null)
    const res = await window.api.git.commit(repo.path, subject, description)
    if (!res.ok) {
      setBusy(false)
      setError(res.error ?? 'Commit failed')
      return
    }
    if (alsoPush) {
      const pushRes = await window.api.git.push(repo.path)
      setBusy(false)
      if (!pushRes.ok) {
        setError(`Committed, but push failed: ${pushRes.error ?? ''}`)
        onDone({ kind: 'error', text: 'Push failed' })
        return
      }
      onDone({ kind: 'ok', text: 'Committed & pushed' })
    } else {
      setBusy(false)
      onDone({ kind: 'ok', text: 'Committed' })
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-24"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GitCommit className="size-4" /> Commit changes
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" />
            {status?.branch ?? '…'}
            <span className="text-foreground/60">·</span>
            {status?.clean ? 'working tree clean' : `${status?.changedFiles ?? 0} file(s) changed`}
            <RefreshCw className="size-3" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Summary of changes"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(false)
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description <span className="opacity-60">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Extended description of what changed and why"
              rows={5}
              className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {nothingToCommit && (
            <p className="text-xs text-muted-foreground">
              Nothing is staged or modified — there may be no changes to commit.
            </p>
          )}
          {error && (
            <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => run(false)} disabled={busy || !subject.trim()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <GitCommit className="size-3.5" />}
            Commit
          </Button>
          <Button size="sm" onClick={() => run(true)} disabled={busy || !subject.trim()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Commit & Push
          </Button>
        </div>
      </div>
    </div>
  )
}
