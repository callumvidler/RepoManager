import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { PanelConfig } from '@/store/useAppStore'
import {
  buildClaudeCommand,
  EFFORT_LEVELS,
  PERMISSION_MODES,
  type Effort,
  type PermissionMode
} from '@/lib/claude'

interface Props {
  defaultTitle: string
  onCreate: (config: PanelConfig) => void
  onClose: () => void
}

export function NewClaudePanelDialog({ defaultTitle, onCreate, onClose }: Props): React.JSX.Element {
  const settings = useSettingsStore()

  const [title, setTitle] = useState(defaultTitle)
  const [base, setBase] = useState(settings.claudeCommand)
  const [model, setModel] = useState(settings.defaultModel)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(settings.defaultPermissionMode)
  const [effort, setEffort] = useState<Effort>(settings.defaultEffort)
  const [continueSession, setContinueSession] = useState(false)
  const [extraArgs, setExtraArgs] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const command = buildClaudeCommand(base, {
    model,
    permissionMode,
    effort,
    continueSession,
    extraArgs
  })

  const create = (): void => {
    onCreate({ title, command })
    onClose()
  }

  const modeHint = PERMISSION_MODES.find((m) => m.value === permissionMode)?.hint

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 pt-20"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
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

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <Row label="Label">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle} />
          </Row>

          <div className="grid grid-cols-2 gap-3">
            <Row label="Permission mode" description={modeHint}>
              <Select
                value={permissionMode}
                onChange={(v) => setPermissionMode(v as PermissionMode)}
                options={PERMISSION_MODES}
              />
            </Row>
            <Row label="Effort">
              <Select value={effort} onChange={(v) => setEffort(v as Effort)} options={EFFORT_LEVELS} />
            </Row>
          </div>

          <Row label="Model" description="Optional — alias (opus, sonnet, fable) or full name.">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="default"
              className="font-mono text-xs"
            />
          </Row>

          <ToggleRow
            label="Continue last session"
            description="Resume the most recent conversation (--continue)."
            checked={continueSession}
            onChange={setContinueSession}
          />

          <Row label="Command" description="Editable base command.">
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="claude"
              className="font-mono text-xs"
            />
          </Row>

          <Row label="Extra arguments" description="Optional — appended verbatim.">
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

function Select({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-popover text-popover-foreground">
          {o.label}
        </option>
      ))}
    </select>
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
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">
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
}): React.JSX.Element {
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
