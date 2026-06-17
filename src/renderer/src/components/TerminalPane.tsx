import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useSettingsStore } from '@/store/useSettingsStore'

export interface TerminalPaneProps {
  /** Stable unique id for this PTY session. */
  ptyId: string
  repoPath: string
  /** Command to run in the login shell. Undefined = plain interactive shell. */
  command?: string
  /** Bump this value to force a respawn (e.g. Run pressed again). */
  spawnKey?: number
  className?: string
  onExit?: (code: number) => void
  onError?: (message: string) => void
  /** Fired when the session rings the terminal bell (waiting for the user). */
  onAttention?: () => void
  /** Fired when the user types into this terminal (acknowledging it). */
  onActivity?: () => void
}

/**
 * One xterm instance bound to a node-pty session over IPC. Reused by both the
 * app-output terminal and every Claude panel.
 */
export function TerminalPane({
  ptyId,
  repoPath,
  command,
  spawnKey = 0,
  className,
  onExit,
  onError,
  onAttention,
  onActivity
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const fontSize = useSettingsStore((s) => s.terminalFontSize)
  const fontFamily = useSettingsStore((s) => s.terminalFontFamily)
  // Latest font settings, read at terminal-creation time without re-triggering it.
  const fontSizeRef = useRef(fontSize)
  const fontFamilyRef = useRef(fontFamily)
  fontSizeRef.current = fontSize
  fontFamilyRef.current = fontFamily
  // Latest attention/activity callbacks, read inside the once-per-spawn effect.
  const onAttentionRef = useRef(onAttention)
  const onActivityRef = useRef(onActivity)
  onAttentionRef.current = onAttention
  onActivityRef.current = onActivity

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let disposed = false
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: fontFamilyRef.current,
      fontSize: fontSizeRef.current,
      allowProposedApi: true,
      theme: { background: '#0a0a0a', foreground: '#e5e5e5' }
    })
    termRef.current = term
    const fit = new FitAddon()
    fitRef.current = fit
    term.loadAddon(fit)
    term.open(el)

    // WebGL renderer is faster but can fail on some GPU states — fall back gracefully.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      /* default DOM/canvas renderer is fine */
    }

    const safeFit = (): void => {
      try {
        if (el.clientWidth > 0 && el.clientHeight > 0) fit.fit()
      } catch {
        /* container not laid out yet */
      }
    }

    const sendInput = term.onData((data) => {
      onActivityRef.current?.()
      window.api.pty.input(ptyId, data)
    })

    // Claude Code rings the terminal bell when it finishes a turn / needs input.
    const offBell = term.onBell(() => onAttentionRef.current?.())

    const offData = window.api.pty.onData((payload) => {
      if (payload.ptyId === ptyId) term.write(payload.data)
    })
    const offExit = window.api.pty.onExit((payload) => {
      if (payload.ptyId !== ptyId) return
      term.writeln(`\r\n\x1b[90m[process exited with code ${payload.exitCode}]\x1b[0m`)
      onExit?.(payload.exitCode)
    })

    // Initial fit must happen after the element has a layout size.
    const raf = requestAnimationFrame(async () => {
      safeFit()
      const result = await window.api.pty.spawn({
        ptyId,
        repoPath,
        command,
        cols: term.cols,
        rows: term.rows
      })
      if (disposed) {
        // Unmounted before spawn resolved — kill the now-registered session.
        window.api.pty.kill(ptyId)
        return
      }
      if (!result.ok) {
        const msg = result.error ?? 'Failed to start terminal'
        setStatusMsg(msg)
        term.writeln(`\x1b[31m${msg}\x1b[0m`)
        onError?.(msg)
      }
    })

    let resizeRaf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        safeFit()
        window.api.pty.resize(ptyId, term.cols, term.rows)
      })
    })
    ro.observe(el)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      ro.disconnect()
      offData()
      offExit()
      offBell.dispose()
      sendInput.dispose()
      window.api.pty.kill(ptyId)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // Respawn when the target session, repo, command, or spawnKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptyId, repoPath, command, spawnKey])

  // Apply font setting changes to the live terminal without respawning the PTY.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontSize = fontSize
    term.options.fontFamily = fontFamily
    const id = requestAnimationFrame(() => {
      try {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          fitRef.current?.fit()
          window.api.pty.resize(ptyId, term.cols, term.rows)
        }
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [fontSize, fontFamily, ptyId])

  return (
    <div className={className} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', padding: '4px 6px' }} />
      {statusMsg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-destructive/80 px-2 py-1 text-xs text-destructive-foreground">
          {statusMsg}
        </div>
      )}
    </div>
  )
}
