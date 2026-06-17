import { app, ipcMain, Notification, BrowserWindow } from 'electron'

export interface NotifyOptions {
  title: string
  body: string
}

/**
 * OS-level notifications for "Claude is waiting" alerts. The renderer decides
 * *when* to fire (e.g. only while the window is unfocused); the main process
 * owns the native Notification, the dock/taskbar badge, and window focusing.
 */
export function registerNotifyHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('notify:show', (_event, opts: NotifyOptions): void => {
    if (!Notification.isSupported()) return
    const notification = new Notification({ title: opts.title, body: opts.body })
    // Clicking the notification brings the app to the foreground.
    notification.on('click', () => {
      const win = getWindow()
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    })
    notification.show()
  })

  // Reflect the number of waiting sessions on the dock (macOS) / taskbar badge.
  ipcMain.handle('notify:setBadge', (_event, count: number): void => {
    const win = getWindow()
    try {
      if (process.platform === 'darwin' && app.dock) {
        app.dock.setBadge(count > 0 ? String(count) : '')
      } else {
        app.setBadgeCount(count)
      }
    } catch {
      /* badges are best-effort and unsupported on some platforms */
    }
    // Gently flag the window in the taskbar when it isn't focused.
    if (win && count > 0 && !win.isFocused()) win.flashFrame(true)
    else if (win) win.flashFrame(false)
  })
}
