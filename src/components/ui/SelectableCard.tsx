import { forwardRef, type HTMLAttributes } from 'react'

interface SelectableCardProps extends HTMLAttributes<HTMLElement> {
  selected?: boolean
  locked?: boolean
  interactive?: boolean
}

export const SelectableCard = forwardRef<HTMLElement, SelectableCardProps>(function SelectableCard(
  { selected, locked, interactive = true, className = '', children, ...props },
  ref,
) {
  const tone = locked ? 'card-locked' : selected ? 'card-selected' : 'card-muted'
  return (
    <article
      ref={ref}
      className={`card-base ${tone} ${interactive ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </article>
  )
})
