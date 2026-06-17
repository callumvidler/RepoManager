import { Panel, Group, Separator, useDefaultLayout } from 'react-resizable-panels'
import { FolderGit2 } from 'lucide-react'
import { ClaudePanelGrid } from './ClaudePanelGrid'
import { AppOutputTerminal } from './AppOutputTerminal'
import { GitControls } from './GitControls'
import { useAppStore } from '@/store/useAppStore'
import type { RepoRecord } from '../../../preload/index'

export function Workspace(): React.JSX.Element {
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

function WorkspaceBody({ repo }: { repo: RepoRecord }): React.JSX.Element {
  // v4 replaces the old `autoSaveId` with an explicit layout/storage hook.
  // Persist each repo's split to localStorage, keyed by repo id.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `repo-manager-split-${repo.id}`,
    storage: localStorage
  })
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div
        className="flex items-center gap-2 border-b px-4 py-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-sm font-semibold">{repo.name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{repo.path}</span>
        <GitControls repo={repo} />
      </div>

      <Group
        orientation="vertical"
        className="min-h-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel defaultSize={65} minSize={20}>
          <ClaudePanelGrid repo={repo} />
        </Panel>
        <Separator className="h-[3px] bg-border transition-colors hover:bg-ring" />
        <Panel defaultSize={35} minSize={10}>
          <AppOutputTerminal repo={repo} />
        </Panel>
      </Group>
    </div>
  )
}
