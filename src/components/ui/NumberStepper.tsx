interface NumberStepperProps {
  value: string
  unitLabel: string
  minReached?: boolean
  maxReached?: boolean
  decreaseLabel: string
  increaseLabel: string
  onDecrease: () => void
  onIncrease: () => void
  onChange: (value: string) => void
  onCommit: () => void
}

export function NumberStepper({
  value,
  unitLabel,
  minReached,
  maxReached,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  onChange,
  onCommit,
}: NumberStepperProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-ink-200 bg-white">
      <button
        type="button"
        className="px-3 py-1.5 text-ink-500 transition hover:text-ink-900 disabled:opacity-30"
        disabled={minReached}
        onClick={onDecrease}
        aria-label={decreaseLabel}
      >
        -
      </button>
      <div className="flex items-center gap-1 border-x border-ink-200 px-2 py-1.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="w-9 bg-transparent text-center text-sm font-medium text-ink-800 outline-none tabular-nums"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <span className="text-sm text-ink-500">{unitLabel}</span>
      </div>
      <button
        type="button"
        className="px-3 py-1.5 text-ink-500 transition hover:text-ink-900 disabled:opacity-30"
        disabled={maxReached}
        onClick={onIncrease}
        aria-label={increaseLabel}
      >
        +
      </button>
    </div>
  )
}
