import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidthClassName?: string
  bodyClassName?: string
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  maxWidthClassName = 'max-w-xl',
  bodyClassName = 'space-y-5',
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/36 px-2 py-2 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
      <div
        className={`relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-[20px] border border-white/80 bg-[#fffaf9]/95 shadow-pop sm:rounded-[28px] ${maxWidthClassName}`}
      >
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand-100/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-accent-100/25 blur-3xl" />
        <header className="relative flex items-center justify-between border-b border-brand-100/70 bg-white/82 px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="text-base font-semibold tracking-[-0.035em] text-ink-900 sm:text-lg">{title}</h3>
          <button className="icon-btn bg-white/80" onClick={onClose} aria-label="close">
            ×
          </button>
        </header>

        <div className={`relative flex-1 overflow-y-auto bg-[#fffaf9]/90 px-4 py-4 sm:px-6 sm:py-5 ${bodyClassName}`}>{children}</div>

        {footer && (
          <footer className="relative flex items-center justify-end gap-2 border-t border-brand-100/70 bg-white/88 px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
