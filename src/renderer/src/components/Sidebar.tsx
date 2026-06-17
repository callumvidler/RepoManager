import { useEffect, useState } from 'react'
import { FolderGit2, Plus, Trash2, FolderOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { SettingsDialog } from './SettingsDialog'

export function Sidebar(): JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const selectedRepoId = useAppStore((s) => s.selectedRepoId)
  const setRepos = useAppStore((s) => s.setRepos)
  const upsertRepo = useAppStore((s) => s.upsertRepo)
  const removeRepo = useAppStore((s) => s.removeRepo)
  const selectRepo = useAppStore((s) => s.selectRepo)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    window.api.repos.list().then(setRepos)
  }, [setRepos])

  const handleAdd = async (): Promise<void> => {
    const repo = await window.api.repos.add()
    if (repo) {
      upsertRepo(repo)
      selectRepo(repo.id)
    }
  }

  const handleRemove = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.api.repos.remove(id)
    removeRepo(id)
  }

  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card/40">
      <div
        className="flex items-center gap-2 px-4 pb-3 pt-10"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <FolderGit2 className="size-4" />
        <span className="flex-1 text-sm font-semibold">RepoManager</span>
        <button
          onClick={handleAdd}
          style={noDrag}
          title="Add repository"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {repos.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No repositories yet. Click <Plus className="inline size-3" /> above to add a folder.
          </p>
        )}
        {repos.map((repo) => (
          <div
            key={repo.id}
            onClick={() => selectRepo(repo.id)}
            className={cn(
              'group mb-1 flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm',
              repo.id === selectedRepoId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
          >
            <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{repo.name}</div>
              <div className="truncate text-xs text-muted-foreground">{repo.path}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.api.repos.reveal(repo.path)
              }}
              className="hidden rounded p-1 text-muted-foreground hover:bg-background group-hover:block"
              title="Reveal in Finder"
            >
              <FolderOpen className="size-3.5" />
            </button>
            <button
              onClick={(e) => handleRemove(repo.id, e)}
              className="hidden rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive group-hover:block"
              title="Remove repository"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center border-t p-2">
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-4" />
          Settings
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
