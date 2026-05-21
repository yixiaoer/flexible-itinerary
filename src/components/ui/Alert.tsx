import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'warning' | 'success' | 'info'

const variantClass: Record<AlertVariant, string> = {
  error: 'alert-error',
  warning: 'alert-warning',
  success: 'alert-success',
  info: 'alert-info',
}

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
  className?: string
}

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
  return <div className={`${variantClass[variant]} ${className}`}>{children}</div>
}
