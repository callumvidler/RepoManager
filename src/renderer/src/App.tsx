import { useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Workspace } from '@/components/Workspace'
import { useSettingsStore } from '@/store/useSettingsStore'

function App(): React.JSX.Element {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const apply = (): void => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    return undefined
  }, [theme])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <Workspace />
    </div>
  )
}

export default App
