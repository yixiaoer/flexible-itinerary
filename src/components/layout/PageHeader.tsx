import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <section className={`surface-glass relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 -top-24 h-48 w-48 rounded-full bg-accent-100/50 blur-3xl" />
      <div className="flex flex-col gap-6 px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 text-caption font-semibold uppercase tracking-[0.22em] text-brand-600">
              {eyebrow}
            </div>
          )}
          <h1 className="truncate text-[2.6rem] font-semibold leading-tight tracking-[-0.055em] text-ink-900">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-base leading-7 text-ink-600">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  )
}
