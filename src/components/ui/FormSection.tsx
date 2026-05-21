import type { ReactNode } from 'react'

interface FormSectionProps {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}

export function FormSection({ label, hint, children, className = '' }: FormSectionProps) {
  return (
    <section className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="label-hint">{hint}</p>}
    </section>
  )
}
