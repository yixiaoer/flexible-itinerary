import type { ReactNode } from 'react'

interface PanelHeaderProps {
  icon?: ReactNode
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PanelHeader({ icon, title, meta, actions, className = '' }: PanelHeaderProps) {
  return (
    <div className={`panel-header ${className}`}>
      {(icon || title || meta) && (
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {icon && <span className="shrink-0 text-ink-400">{icon}</span>}
          <span className="truncate font-semibold text-ink-900">{title}</span>
          {meta}
        </div>
      )}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
