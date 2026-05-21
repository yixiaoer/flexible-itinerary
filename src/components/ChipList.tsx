import { useState } from 'react'

interface Props {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel?: string
  /** Optional preset suggestions; clicking one inserts it (deduped). */
  presets?: { value: string; label: string }[]
  /** Optional small icon prefix per chip. */
  iconFor?: (value: string, index: number) => string | undefined
}

export function ChipList({ values, onChange, placeholder, addLabel = '+ 添加', presets, iconFor }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))

  const submit = () => {
    const v = draft.trim()
    if (!v) {
      setAdding(false)
      setDraft('')
      return
    }
    if (!values.includes(v)) onChange([...values, v])
    setDraft('')
    setAdding(false)
  }

  const addPreset = (v: string) => {
    if (!values.includes(v)) onChange([...values, v])
  }

  const remainingPresets = presets?.filter((p) => !values.includes(p.value)) ?? []

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={`${v}-${i}`} className="pill">
            {iconFor?.(v, i) && <span className="text-ink-400">{iconFor(v, i)}</span>}
            <span className="max-w-[160px] truncate">{v}</span>
            <button
              type="button"
              className="pill-x"
              onClick={() => remove(i)}
              aria-label="remove"
            >
              ×
            </button>
          </span>
        ))}

        {adding ? (
          <input
            autoFocus
            className="rounded-full border border-brand-300 bg-white px-2.5 py-1 text-xs outline-none ring-2 ring-brand-100"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape') {
                setAdding(false)
                setDraft('')
              }
            }}
            placeholder={placeholder}
          />
        ) : (
          <button type="button" className="pill-add" onClick={() => setAdding(true)}>
            {addLabel}
          </button>
        )}
      </div>

      {remainingPresets.length > 0 && !adding && (
        <div className="flex flex-wrap gap-1">
          {remainingPresets.map((p) => (
            <button
              key={p.value}
              type="button"
              className="rounded-full bg-ink-50 px-2 py-0.5 text-caption text-ink-500 transition hover:bg-brand-50 hover:text-brand-700"
              onClick={() => addPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
