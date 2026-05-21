import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`surface flex flex-col items-center justify-center gap-3 p-8 text-center ${className}`}>
      {icon}
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
