import { useEffect, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  side?: 'right' | 'bottom'
  className?: string
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  side = 'right',
  className = '',
}: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const align = side === 'bottom' ? 'items-end' : 'justify-end'
  const shape =
    side === 'bottom'
      ? 'max-h-[82vh] w-full rounded-t-2xl'
      : 'h-full w-full max-w-md'

  return (
    <div className={`fixed inset-0 z-40 flex ${align}`}>
      <div className="absolute inset-0 bg-ink-900/30" onClick={onClose} />
      <aside className={`relative flex flex-col bg-white shadow-pop ${shape} ${className}`}>
        <header className="flex items-center justify-between border-b border-ink-200 px-6 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            x
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  )
}
