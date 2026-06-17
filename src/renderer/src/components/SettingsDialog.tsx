import { useEffect } from 'react'
import { X, Monitor, Moon, Sun, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSettingsStore, type ThemeMode } from '@/store/useSettingsStore'

interface Props {
  open: boolean
  onClose: () => void
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
]

export function SettingsDialog({ open, onClose }: Props): JSX.Element | null {
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
        className="w-full max-w-md overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
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

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-4">
          <Section title="Appearance">
            <Field label="Theme" description="Color theme for the app interface.">
              <div className="flex gap-1 rounded-lg border bg-background p-1">
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

            <Field label="Terminal font size" description="Font size used in all terminals.">
              <div className="flex items-center gap-2">
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

            <Field label="Terminal font family">
              <Input
                value={s.terminalFontFamily}
                onChange={(e) => s.setTerminalFontFamily(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          </Section>

          <Section title="Claude Code">
            <Field
              label="Auto-start on open"
              description="Open a Claude session automatically when a repo is first opened."
              inline
            >
              <Toggle checked={s.autoStartClaude} onChange={s.setAutoStartClaude} />
            </Field>

            <Field label="Claude command" description="Command run in new Claude panels.">
              <Input
                value={s.claudeCommand}
                onChange={(e) => s.setClaudeCommand(e.target.value)}
                placeholder="claude"
                className="font-mono text-xs"
              />
            </Field>
          </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
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
}): JSX.Element {
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

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
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
