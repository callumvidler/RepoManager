import { useEffect, useState } from 'react'
import {
  X,
  Monitor,
  Moon,
  Sun,
  RotateCcw,
  Palette,
  SquareTerminal,
  Sparkles,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSettingsStore, type ThemeMode } from '@/store/useSettingsStore'
import {
  EFFORT_LEVELS,
  PERMISSION_MODES,
  type Effort,
  type PermissionMode
} from '@/lib/claude'

interface Props {
  open: boolean
  onClose: () => void
}

type TabId = 'appearance' | 'terminal' | 'claude'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'claude', label: 'Claude Code', icon: Sparkles }
]

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

export function SettingsDialog({ open, onClose }: Props): React.JSX.Element | null {
  const [tab, setTab] = useState<TabId>('appearance')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const s = useSettingsStore()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Tab rail */}
          <nav className="w-48 shrink-0 space-y-1 border-r bg-card/40 p-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  tab === id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
            {tab === 'appearance' && (
              <Section title="Appearance" description="Customize how the app looks.">
                <Field label="Theme" description="Color theme for the app interface.">
                  <div className="flex max-w-sm gap-1 rounded-lg border bg-background p-1">
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => s.setTheme(value)}
                        className={cn(
                          'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                          s.theme === value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </Section>
            )}

            {tab === 'terminal' && (
              <Section title="Terminal" description="Font and rendering for all embedded terminals.">
                <Field label="Font size" description="Applied live to every open terminal.">
                  <div className="flex max-w-sm items-center gap-3">
                    <input
                      type="range"
                      min={8}
                      max={24}
                      value={s.terminalFontSize}
                      onChange={(e) => s.setTerminalFontSize(Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                      {s.terminalFontSize}px
                    </span>
                  </div>
                </Field>

                <Field label="Font family">
                  <Input
                    value={s.terminalFontFamily}
                    onChange={(e) => s.setTerminalFontFamily(e.target.value)}
                    className="max-w-md font-mono text-xs"
                  />
                </Field>
              </Section>
            )}

            {tab === 'claude' && (
              <Section title="Claude Code" description="Defaults for new Claude sessions.">
                <Field
                  label="Auto-start on open"
                  description="Open a Claude session automatically when a repo is first opened."
                  inline
                >
                  <Toggle checked={s.autoStartClaude} onChange={s.setAutoStartClaude} />
                </Field>

                <Field
                  label="Default permission mode"
                  description="Applied to new panels (e.g. plan mode, auto). Override per panel when creating one."
                >
                  <Select
                    value={s.defaultPermissionMode}
                    onChange={(v) => s.setDefaultPermissionMode(v as PermissionMode)}
                    options={PERMISSION_MODES}
                    className="max-w-xs"
                  />
                </Field>

                <Field label="Default effort" description="Reasoning effort applied to new panels.">
                  <Select
                    value={s.defaultEffort}
                    onChange={(v) => s.setDefaultEffort(v as Effort)}
                    options={EFFORT_LEVELS}
                    className="max-w-xs"
                  />
                </Field>

                <Field label="Default model" description="Optional — alias (opus, sonnet, fable) or full name.">
                  <Input
                    value={s.defaultModel}
                    onChange={(e) => s.setDefaultModel(e.target.value)}
                    placeholder="default"
                    className="max-w-md font-mono text-xs"
                  />
                </Field>

                <Field
                  label="Default command"
                  description="Base command for new Claude panels."
                >
                  <Input
                    value={s.claudeCommand}
                    onChange={(e) => s.setClaudeCommand(e.target.value)}
                    placeholder="claude"
                    className="max-w-md font-mono text-xs"
                  />
                </Field>
              </Section>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={s.reset}>
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Field({
  label,
  description,
  inline = false,
  children
}: {
  label: string
  description?: string
  /** Render the control to the right of the label (e.g. a toggle) instead of below. */
  inline?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
        {inline && <div className="shrink-0">{children}</div>}
      </div>
      {!inline && children}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  className
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-popover text-popover-foreground">
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
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
  )
}
