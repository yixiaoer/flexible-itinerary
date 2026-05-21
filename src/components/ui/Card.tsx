import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padded?: boolean
  elevated?: boolean
}

export function Card({ children, className = '', padded = true, elevated = false }: CardProps) {
  return (
    <section className={`${elevated ? 'card-elevated' : 'surface'} ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </section>
  )
}
