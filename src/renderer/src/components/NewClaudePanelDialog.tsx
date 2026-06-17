import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { PanelConfig } from '@/store/useAppStore'

interface Props {
  defaultTitle: string
  onCreate: (config: PanelConfig) => void
  onClose: () => void
}

function buildCommand(
  base: string,
  opts: { model: string; continueSession: boolean; skipPermissions: boolean; extraArgs: string }
): string {
  let cmd = base.trim() || 'claude'
  if (opts.continueSession) cmd += ' --continue'
  if (opts.model.trim()) cmd += ` --model ${opts.model.trim()}`
  if (opts.skipPermissions) cmd += ' --dangerously-skip-permissions'
  if (opts.extraArgs.trim()) cmd += ` ${opts.extraArgs.trim()}`
  return cmd
}

export function NewClaudePanelDialog({ defaultTitle, onCreate, onClose }: Props): JSX.Element {
  const defaultCommand = useSettingsStore((s) => s.claudeCommand)

  const [title, setTitle] = useState(defaultTitle)
  const [base, setBase] = useState(defaultCommand)
  const [model, setModel] = useState('')
  const [continueSession, setContinueSession] = useState(false)
  const [skipPermissions, setSkipPermissions] = useState(false)
  const [extraArgs, setExtraArgs] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const command = buildCommand(base, { model, continueSession, skipPermissions, extraArgs })

  const create = (): void => {
    onCreate({ title, command })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" /> New Claude panel
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Row label="Label">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle} />
          </Row>

          <Row label="Command">
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="claude"
              className="font-mono text-xs"
            />
          </Row>

          <Row label="Model" description="Optional — passed as --model.">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. claude-opus-4-8 (leave blank for default)"
              className="font-mono text-xs"
            />
          </Row>

          <ToggleRow
            label="Continue last session"
            description="Resume the most recent conversation (--continue)."
            checked={continueSession}
            onChange={setContinueSession}
          />

          <ToggleRow
            label="Skip permission prompts"
            description="Runs with --dangerously-skip-permissions. Use with care."
            checked={skipPermissions}
            onChange={setSkipPermissions}
          />

          <Row label="Extra arguments" description="Optional — appended to the command verbatim.">
            <Input
              value={extraArgs}
              onChange={(e) => setExtraArgs(e.target.value)}
              placeholder="--verbose"
              className="font-mono text-xs"
            />
          </Row>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Preview</div>
            <code className="block truncate rounded-md border bg-background px-3 py-2 font-mono text-xs">
              {command}
            </code>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={create}>
            <Sparkles className="size-3.5" /> Create panel
          </Button>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {description && <span className="ml-1 opacity-70">— {description}</span>}
      </label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}
