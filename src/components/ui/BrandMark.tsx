type BrandMarkSize = 'sm' | 'md' | 'lg'

const sizeClass: Record<BrandMarkSize, string> = {
  sm: 'h-7 w-7 rounded-md text-xs',
  md: 'h-8 w-8 rounded-lg text-sm',
  lg: 'h-14 w-14 rounded-2xl text-xl',
}

interface BrandMarkProps {
  label?: string
  size?: BrandMarkSize
  className?: string
}

export function BrandMark({ label = 'FI', size = 'md', className = '' }: BrandMarkProps) {
  return (
    <div
      className={`grad-brand flex shrink-0 items-center justify-center font-bold text-white shadow-sm ${sizeClass[size]} ${className}`}
    >
      {label}
    </div>
  )
}
