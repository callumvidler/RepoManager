import { useEffect, useRef, useState } from 'react'
import { Play, Square, Save, Pencil, Terminal as TerminalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TerminalPane } from './TerminalPane'
import type { RepoRecord } from '../../../preload/index'

interface Props {
  repo: RepoRecord
}

/**
 * Dedicated terminal that runs the repo's dev/run command. The command is
 * auto-detected from package.json but editable and persisted per repo.
 */
export function AppOutputTerminal({ repo }: Props): JSX.Element {
  const [command, setCommand] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [spawnKey, setSpawnKey] = useState(0)
  const ptyId = `output-${repo.id}`

  // Resolve the command for this repo: saved override wins, else detect.
  useEffect(() => {
    let cancelled = false
    setRunning(false)
    async function resolve(): Promise<void> {
      if (repo.runCommand) {
        if (!cancelled) setCommand(repo.runCommand)
        return
      }
      const detection = await window.api.repos.detect(repo.path)
      if (!cancelled) setCommand(detection.runCommand ?? '')
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [repo.id, repo.path, repo.runCommand])

  const startEditing = (): void => {
    setDraft(command)
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    setCommand(draft)
    setEditing(false)
    await window.api.repos.setRunCommand(repo.id, draft)
  }

  const run = (): void => {
    if (!command) return
    setRunning(true)
    setSpawnKey((k) => k + 1)
  }

  const stop = (): void => {
    window.api.pty.kill(ptyId)
    setRunning(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card/40 px-3 py-1.5">
        <TerminalIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">App output</span>

        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. npm run dev"
              className="h-7 font-mono text-xs"
              autoFocus
            />
            <Button size="sm" variant="secondary" onClick={save}>
              <Save className="size-3.5" /> Save
            </Button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="group flex flex-1 items-center gap-1.5 rounded px-2 py-0.5 text-left font-mono text-xs hover:bg-accent/50"
            title="Edit run command"
          >
            <span className={command ? '' : 'text-muted-foreground'}>
              {command || 'No run command — click to set'}
            </span>
            <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}

        {!editing &&
          (running ? (
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={run} disabled={!command}>
              <Play className="size-3.5" /> Run
            </Button>
          ))}
      </div>

      <div className="min-h-0 flex-1 bg-[#0a0a0a]">
        {running ? (
          <TerminalPane
            key={`${ptyId}-${spawnKey}`}
            ptyId={ptyId}
            repoPath={repo.path}
            command={command}
            spawnKey={spawnKey}
            onExit={() => setRunning(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Press Run to start <span className="mx-1 font-mono">{command || 'the dev server'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
