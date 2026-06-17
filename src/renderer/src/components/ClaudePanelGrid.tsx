import { useEffect, useRef, useState } from 'react'
import { Plus, X, Sparkles, Pencil, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TerminalPane } from './TerminalPane'
import { NewClaudePanelDialog } from './NewClaudePanelDialog'
import { useAppStore } from '@/store/useAppStore'
import { useSettingsStore } from '@/store/useSettingsStore'
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
  const attentionPanels = useAppStore((s) => s.attentionPanels)
  const markAttention = useAppStore((s) => s.markAttention)
  const clearAttention = useAppStore((s) => s.clearAttention)
  const attentionAlerts = useSettingsStore((s) => s.attentionAlerts)
  const osNotifications = useSettingsStore((s) => s.osNotifications)
  const [creating, setCreating] = useState(false)

  // Called when a panel rings the bell. Flags it for the in-app highlight and,
  // if the window isn't focused, raises a native notification (once per wait).
  const handleAttention = (panel: { id: string; title: string }): void => {
    const alreadyWaiting = !!useAppStore.getState().attentionPanels[panel.id]
    markAttention(panel.id)
    if (!alreadyWaiting && osNotifications && !document.hasFocus()) {
      window.api.notify.show({
        title: 'Claude is waiting for your response',
        body: `${repo.name} · ${panel.title}`
      })
    }
  }

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
          {panels.map((panel) => {
            const waiting = attentionAlerts && !!attentionPanels[panel.id]
            return (
              <div
                key={panel.id}
                onMouseDown={() => clearAttention(panel.id)}
                className={cn(
                  'flex min-h-0 flex-col overflow-hidden rounded-lg border bg-[#0a0a0a] transition-shadow',
                  waiting && 'border-amber-400/70 shadow-[0_0_0_1px_rgb(251_191_36/0.5)]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 border-b px-2 py-1 transition-colors',
                    waiting ? 'bg-amber-400/15' : 'bg-card/60'
                  )}
                >
                  {waiting ? (
                    <Bell className="size-3.5 shrink-0 animate-pulse text-amber-400" />
                  ) : (
                    <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <PanelTitle
                    title={panel.title}
                    onRename={(title) => renamePanel(repo.id, panel.id, title)}
                  />
                  {waiting && (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                      Waiting
                    </span>
                  )}
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
                    onAttention={() => handleAttention(panel)}
                    onActivity={() => clearAttention(panel.id)}
                  />
                </div>
              </div>
            )
          })}
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
