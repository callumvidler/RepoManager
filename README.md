# RepoManager

A desktop app to manage your local git repositories and run [Claude Code](https://claude.com/claude-code) against them. Add repo folders, run each repo's dev server in a dedicated terminal, and open a grid of interactive Claude Code sessions per repo.

## Stack

- **Electron** + **TypeScript** + **React** (scaffolded with [electron-vite](https://electron-vite.org))
- **shadcn/ui** + **Tailwind CSS v4**
- Embedded terminals via **[xterm.js](https://xtermjs.org)** (renderer) + **[node-pty](https://github.com/microsoft/node-pty)** (main) over IPC

## Features

- **Repo sidebar** — add folders via a native picker; the list persists across restarts (`electron-store`).
- **App output terminal** — Run/Stop the repo's dev command. The command is auto-detected from `package.json` (`dev` → `start`) and the package manager from the lockfile (`pnpm`/`yarn`/`bun`/`npm`). Editable and saved per repo.
- **Claude Code grid** — open multiple independent `claude` terminal panels per repo, laid out in a responsive grid. Add/close panels dynamically.

## Develop

```bash
npm install      # also rebuilds node-pty against Electron's ABI (postinstall)
npm run dev      # launch the app with hot reload
npm run typecheck
npm run build    # build all three targets
npm run dist     # package a distributable (electron-builder)
```

## How PTYs are spawned

Every terminal spawns the user's **login + interactive shell** (`$SHELL -lic '<command>'`) in the repo's directory. This is required because a GUI app launched from Finder inherits a minimal `launchd` PATH — `claude` (which may be a shell function), `node` (via nvm), and package managers are only resolvable after the shell sources `.zprofile`/`.zshrc`. The resolved login-shell environment is also cached at startup (`src/main/shell-env.ts`).

## Project layout

```
src/
├─ main/                 # Electron main process
│  ├─ index.ts           # window + lifecycle, before-quit PTY cleanup
│  ├─ store.ts           # electron-store: repos + per-repo runCommand
│  ├─ shell-env.ts       # resolve login-shell PATH once
│  └─ ipc/{pty,repos,detect}.ts
├─ preload/index.ts      # contextBridge `window.api` (the security boundary)
└─ renderer/src/
   ├─ components/        # Sidebar, Workspace, AppOutputTerminal, ClaudePanelGrid, TerminalPane, ui/
   ├─ hooks, store/      # zustand UI state
   └─ assets/main.css    # Tailwind v4 + shadcn theme
```
