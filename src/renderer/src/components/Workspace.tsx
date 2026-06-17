import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { FolderGit2 } from 'lucide-react'
import { ClaudePanelGrid } from './ClaudePanelGrid'
import { AppOutputTerminal } from './AppOutputTerminal'
import { useAppStore } from '@/store/useAppStore'
import type { RepoRecord } from '../../../preload/index'

export function Workspace(): JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const openedRepoIds = useAppStore((s) => s.openedRepoIds)
  const selectedRepoId = useAppStore((s) => s.selectedRepoId)

  // Render every opened repo's terminals and keep them mounted; only the
  // selected one is visible. Switching repos no longer tears down PTYs.
  const openedRepos = repos.filter((r) => openedRepoIds.includes(r.id))

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {openedRepos.map((repo) => (
        <div
          key={repo.id}
          className="absolute inset-0 flex-col"
          style={{ display: repo.id === selectedRepoId ? 'flex' : 'none' }}
        >
          <WorkspaceBody repo={repo} />
        </div>
      ))}

      {!selectedRepoId && (
        <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-center">
          <FolderGit2 className="size-10 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">
            Select a repository, or add one to get started.
          </div>
        </div>
      )}
    </div>
  )
}

function WorkspaceBody({ repo }: { repo: RepoRecord }): JSX.Element {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div
        className="flex items-center gap-2 border-b px-4 py-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <FolderGit2 className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{repo.name}</span>
        <span className="truncate text-xs text-muted-foreground">{repo.path}</span>
      </div>

      <PanelGroup
        direction="vertical"
        className="min-h-0 flex-1"
        autoSaveId={`repo-manager-split-${repo.id}`}
      >
        <Panel defaultSize={65} minSize={20}>
          <ClaudePanelGrid repo={repo} />
        </Panel>
        <PanelResizeHandle className="h-[3px] bg-border transition-colors hover:bg-ring data-[resize-handle-state=drag]:bg-ring" />
        <Panel defaultSize={35} minSize={10}>
          <AppOutputTerminal repo={repo} />
        </Panel>
      </PanelGroup>
    </div>
  )
}
