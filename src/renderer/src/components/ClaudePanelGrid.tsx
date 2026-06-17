import { useEffect, useRef, useState } from 'react'
import { Plus, X, Sparkles, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TerminalPane } from './TerminalPane'
import { NewClaudePanelDialog } from './NewClaudePanelDialog'
import { useAppStore } from '@/store/useAppStore'
import type { RepoRecord } from '../../../preload/index'

interface Props {
  repo: RepoRecord
}

/**
 * Grid of independent Claude Code terminal panels for the selected repo. Each
 * panel is a real interactive PTY running `claude` in the repo's cwd. Panels can
 * be added dynamically and reflow with CSS auto-fit.
 */
export function ClaudePanelGrid({ repo }: Props): React.JSX.Element {
  const panels = useAppStore((s) => s.panelsByRepo[repo.id] ?? [])
  const addPanel = useAppStore((s) => s.addPanel)
  const removePanel = useAppStore((s) => s.removePanel)
  const renamePanel = useAppStore((s) => s.renamePanel)
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card/40 px-3 py-1.5">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Claude Code · {panels.length} panel{panels.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add panel
        </Button>
      </div>

      {panels.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Sparkles className="size-8 text-muted-foreground/50" />
          <div className="text-sm text-muted-foreground">No Claude panels open.</div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Start a Claude session
          </Button>
        </div>
      ) : (
        <div
          className="min-h-0 flex-1 gap-2 overflow-auto p-2"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gridAutoRows: 'minmax(240px, 1fr)'
          }}
        >
          {panels.map((panel) => (
            <div
              key={panel.id}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-[#0a0a0a]"
            >
              <div className="flex items-center gap-2 border-b bg-card/60 px-2 py-1">
                <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                <PanelTitle
                  title={panel.title}
                  onRename={(title) => renamePanel(repo.id, panel.id, title)}
                />
                <button
                  onClick={() => removePanel(repo.id, panel.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                  title="Close panel"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <TerminalPane
                  ptyId={`claude-${repo.id}-${panel.id}`}
                  repoPath={repo.path}
                  command={panel.command}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <NewClaudePanelDialog
          defaultTitle={`Claude ${panels.length + 1}`}
          onCreate={(config) => addPanel(repo.id, config)}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

/** Inline-editable panel label. Click (or the pencil) to rename; Enter/blur saves, Escape cancels. */
function PanelTitle({
  title,
  onRename
}: {
  title: string
  onRename: (title: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = (): void => {
    const next = draft.trim()
    onRename(next || title)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') {
            setDraft(title)
            setEditing(false)
          }
        }}
        className="h-5 min-w-0 flex-1 rounded border border-input bg-background px-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(title)
        setEditing(true)
      }}
      title="Rename panel"
      className="group flex min-w-0 flex-1 items-center gap-1 text-left"
    >
      <span className="truncate text-xs font-medium">{title}</span>
      <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </button>
  )
}
