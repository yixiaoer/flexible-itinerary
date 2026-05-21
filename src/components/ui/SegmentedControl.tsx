export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  className?: string
  itemClassName?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  itemClassName = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented ${className}`}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`segmented-item ${active ? 'segmented-item-active' : ''} ${itemClassName}`}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
