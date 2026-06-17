import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { existsSync, statSync } from 'fs'
import { addRepo, listRepos, removeRepo, updateRepo, type RepoRecord } from '../store'
import { detectRunCommand } from './detect'

export function registerRepoHandlers(): void {
  ipcMain.handle('repos:list', (): RepoRecord[] => listRepos())

  ipcMain.handle('repos:add', async (event): Promise<RepoRecord | null> => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Add repository folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return addRepo(result.filePaths[0])
  })

  ipcMain.handle('repos:remove', (_event, id: string): void => {
    removeRepo(id)
  })

  ipcMain.handle(
    'repos:setRunCommand',
    (_event, id: string, runCommand: string): RepoRecord | undefined => {
      return updateRepo(id, { runCommand })
    }
  )

  ipcMain.handle('repos:detect', (_event, repoPath: string) => {
    if (!isValidDir(repoPath)) return { scripts: {}, isNodeProject: false }
    return detectRunCommand(repoPath)
  })

  ipcMain.handle('repos:reveal', (_event, repoPath: string): void => {
    if (isValidDir(repoPath)) shell.openPath(repoPath)
  })

  ipcMain.handle('repos:exists', (_event, repoPath: string): boolean => isValidDir(repoPath))
}

export function isValidDir(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory()
  } catch {
    return false
  }
}
