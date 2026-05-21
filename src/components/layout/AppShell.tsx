import type { ReactNode } from 'react'

interface AppShellProps {
  header: ReactNode
  sidebar: ReactNode
  main: ReactNode
  aside?: ReactNode
  overlays?: ReactNode
}

export function AppShell({ header, sidebar, main, aside, overlays }: AppShellProps) {
  return (
    <div className="app-bg flex min-h-screen flex-col">
      {header}
      <div
        className={`app-container grid flex-1 gap-6 ${
          aside
            ? 'grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)_420px]'
            : 'grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]'
        }`}
      >
        <aside className="min-w-0 lg:sticky lg:top-[92px] lg:self-start">{sidebar}</aside>
        <main className="min-w-0">{main}</main>
        {aside && (
          <aside className="hidden min-w-0 2xl:block 2xl:sticky 2xl:top-[92px] 2xl:self-start">
            {aside}
          </aside>
        )}
      </div>
      {overlays}
    </div>
  )
}
