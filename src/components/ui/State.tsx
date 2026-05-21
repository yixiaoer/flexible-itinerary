import type { ReactNode } from 'react'
import { Alert } from './Alert'
import { EmptyState } from './EmptyState'

interface LoadingStateProps {
  title: ReactNode
  description?: ReactNode
  className?: string
}

export function LoadingState({ title, description, className = '' }: LoadingStateProps) {
  return (
    <div className={`surface flex items-center gap-3 px-4 py-3 ${className}`}>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
      <div>
        <div className="text-sm font-medium text-ink-900">{title}</div>
        {description && <div className="text-caption text-ink-500">{description}</div>}
      </div>
    </div>
  )
}

interface ErrorStateProps {
  title?: ReactNode
  message: ReactNode
  action?: ReactNode
  className?: string
}

export function ErrorState({ title, message, action, className = '' }: ErrorStateProps) {
  return (
    <Alert variant="error" className={className}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div>{message}</div>
      {action && <div className="mt-3">{action}</div>}
    </Alert>
  )
}

interface BlankStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function BlankState({ icon, title, description, action, className = '' }: BlankStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  )
}
