import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import appIcon from '../icons/repo-manager-fork.png?asset'
import { registerRepoHandlers } from './ipc/repos'
import { registerPtyHandlers, killAllPtys } from './ipc/pty'
import { registerGitHandlers } from './ipc/git'
import { registerNotifyHandlers } from './ipc/notify'
import { getLoginShellEnv } from './shell-env'

/** The primary app window, used by notification handlers to focus on click. */
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'RepoManager',
    // macOS draws the window/dock icon from the app bundle; on Windows the
    // BrowserWindow icon drives the taskbar (notably in dev).
    ...(process.platform === 'darwin' ? {} : { icon: appIcon }),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.repomanager.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Warm the login-shell env cache early so the first PTY spawn is fast.
  void getLoginShellEnv()

  registerRepoHandlers()
  registerPtyHandlers()
  registerGitHandlers()
  registerNotifyHandlers(() => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  killAllPtys()
})

app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') app.quit()
})
