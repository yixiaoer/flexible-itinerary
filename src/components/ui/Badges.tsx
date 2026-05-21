import type { ReactNode } from 'react'

interface CountBadgeProps {
  children: ReactNode
  className?: string
}

export function CountBadge({ children, className = '' }: CountBadgeProps) {
  return (
    <span className={`rounded-full bg-ink-100 px-1.5 text-caption font-medium text-ink-600 ${className}`}>
      {children}
    </span>
  )
}

interface StatTileProps {
  label: ReactNode
  value: ReactNode
  accent?: 'default' | 'brand' | 'amber' | 'blue' | 'red'
  className?: string
}

const accentClass: Record<NonNullable<StatTileProps['accent']>, string> = {
  default: 'text-ink-900',
  brand: 'text-brand-700',
  amber: 'text-amber-700',
  blue: 'text-sky-700',
  red: 'text-red-700',
}

export function StatTile({ label, value, accent = 'default', className = '' }: StatTileProps) {
  return (
    <div className={`rounded-xl border border-ink-200 bg-white px-4 py-3 ${className}`}>
      <div className="text-caption font-medium text-ink-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accentClass[accent]}`}>
        {value}
      </div>
    </div>
  )
}
