export interface OptionTile<T extends string> {
  value: T
  label: string
  description?: string
  activeClassName?: string
}

interface OptionTileGroupProps<T extends string> {
  options: Array<OptionTile<T>>
  value: T
  onChange: (value: T) => void
  columnsClassName?: string
}

export function OptionTileGroup<T extends string>({
  options,
  value,
  onChange,
  columnsClassName = 'grid-cols-1 sm:grid-cols-3',
}: OptionTileGroupProps<T>) {
  return (
    <div className={`grid gap-2 ${columnsClassName}`}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            data-active={active}
            className={`rounded-2xl border px-3.5 py-3 text-left text-xs transition ${
              active
                ? 'border-brand-300 bg-white/72 text-ink-900 shadow-sm ring-2 ring-brand-100/70'
                : 'border-brand-100/70 bg-white/82 text-ink-600 hover:border-brand-200 hover:bg-white'
            } ${option.activeClassName ?? ''}`}
            onClick={() => onChange(option.value)}
          >
            <div className="text-sm font-semibold">{option.label}</div>
            {option.description && (
              <div className="mt-0.5 text-caption opacity-80">{option.description}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
