import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

let cachedEnv: NodeJS.ProcessEnv | null = null

/**
 * A GUI app launched from Finder inherits a minimal launchd PATH, not the
 * user's interactive shell PATH. nvm, Homebrew, and the `claude` shell function
 * are only available after the login shell sources .zprofile/.zshrc. We resolve
 * that environment once and reuse it for every PTY spawn so commands resolve.
 */
export async function getLoginShellEnv(): Promise<NodeJS.ProcessEnv> {
  if (cachedEnv) return cachedEnv

  // Non-mac platforms generally already inherit a usable env.
  if (process.platform === 'win32') {
    cachedEnv = process.env
    return cachedEnv
  }

  const shell = process.env.SHELL || '/bin/zsh'
  try {
    // `-l -i` sources login + interactive rc files; print the resulting env.
    // A unique delimiter lets us ignore any banner noise rc files might print.
    const delimiter = '__REPO_MANAGER_ENV__'
    const { stdout } = await execFileAsync(
      shell,
      ['-lic', `echo ${delimiter}; env`],
      { encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024 }
    )

    const start = stdout.indexOf(delimiter)
    const body = start >= 0 ? stdout.slice(start + delimiter.length) : stdout

    const parsed: NodeJS.ProcessEnv = { ...process.env }
    for (const line of body.split('\n')) {
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq)
      const value = line.slice(eq + 1)
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) parsed[key] = value
    }
    cachedEnv = parsed
  } catch {
    // Fall back to whatever we have; spawning through `$SHELL -lic` still helps.
    cachedEnv = process.env
  }

  return cachedEnv
}
