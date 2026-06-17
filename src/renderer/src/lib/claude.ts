/** Claude Code launch options, mapped to real `claude` CLI flags. */

export type PermissionMode =
  | 'default'
  | 'plan'
  | 'acceptEdits'
  | 'auto'
  | 'dontAsk'
  | 'bypassPermissions'

export type Effort = '' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ClaudeOptions {
  model?: string
  permissionMode?: PermissionMode
  effort?: Effort
  continueSession?: boolean
  extraArgs?: string
}

export const PERMISSION_MODES: { value: PermissionMode; label: string; hint?: string }[] = [
  { value: 'default', label: 'Default', hint: 'Ask for permission as needed' },
  { value: 'plan', label: 'Plan mode', hint: 'Research & plan without making changes' },
  { value: 'acceptEdits', label: 'Accept edits', hint: 'Auto-accept file edits' },
  { value: 'auto', label: 'Auto', hint: 'Run autonomously' },
  { value: 'dontAsk', label: "Don't ask", hint: 'Proceed without prompts' },
  { value: 'bypassPermissions', label: 'Bypass permissions', hint: 'Skip all permission checks' }
]

export const EFFORT_LEVELS: { value: Effort; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' }
]

/** Compose a `claude` command line from a base command and the chosen options. */
export function buildClaudeCommand(base: string, o: ClaudeOptions): string {
  let cmd = base.trim() || 'claude'
  if (o.permissionMode && o.permissionMode !== 'default') {
    cmd += ` --permission-mode ${o.permissionMode}`
  }
  if (o.effort) cmd += ` --effort ${o.effort}`
  if (o.model?.trim()) cmd += ` --model ${o.model.trim()}`
  if (o.continueSession) cmd += ' --continue'
  if (o.extraArgs?.trim()) cmd += ` ${o.extraArgs.trim()}`
  return cmd
}
