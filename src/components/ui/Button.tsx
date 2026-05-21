import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'gradient' | 'outline' | 'ghost' | 'danger' | 'link' | 'quiet'
type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  gradient: 'btn-gradient',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  link: 'btn-link',
  quiet: 'btn-quiet',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${variantClass[variant]} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
