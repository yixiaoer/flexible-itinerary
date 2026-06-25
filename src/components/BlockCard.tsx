import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block } from '../types'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { fmtDuration } from '../lib/time'
import { SelectableCard } from './ui'

interface Props {
  dayId: string
  block: Block
  selected?: boolean
  onSelect: () => void
  onEdit: () => void
  dragging?: boolean
}

const KIND_GLYPH: Record<string, string> = {
  sightseeing: '◆',
  food: '🍴',
  transport: '🚗',
  flight: '✈',
  train: '🚄',
  hotel: '🏨',
  show: '🎭',
  outdoor: '🌳',
  indoor: '🏛',
  rest: '☕',
  other: '·',
}

function nextManualDaypart(daypart: Block['daypart']): 'ANY' | 'AM' | 'PM' | 'EVE' {
  if (daypart === 'ANY') return 'AM'
  if (daypart === 'AM') return 'PM'
  if (daypart === 'PM') return 'EVE'
  // EVE or undefined → back to flexible ("灵活")
  return 'ANY'
}

export function BlockCard({ dayId, block, selected, onSelect, onEdit, dragging = false }: Props) {
  const locale = useSettings((s) => s.locale)
  const toggleLock = useTripStore((s) => s.toggleLock)
  const removeBlock = useTripStore((s) => s.removeBlock)
  const setDaypartBoundary = useTripStore((s) => s.setDaypartBoundary)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: block.locked })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  // ---------- granularity & time strings -----------------------------------
  const isPrecise = block.granularity === 'precise'
  const isWindow = block.granularity === 'window'
  const isFlexible = block.granularity === 'flexible'

  const granLabel = isPrecise
    ? t(locale, 'gPrecise')
    : isWindow
      ? t(locale, 'gWindow')
      : t(locale, 'gFlexible')
  const granChip = isPrecise ? 'chip-brand' : isWindow ? 'chip-blue' : 'chip-green'

  // Top time text
  let topTime: string
  if (isPrecise) {
    topTime = block.startTime ?? '--:--'
  } else if (isWindow) {
    topTime = block.startTime ?? '--:--'
  } else {
    topTime = block.daypart === 'ANY'
      ? t(locale, 'daypartFlexible')
      : block.daypart === 'AM'
        ? t(locale, 'morning')
        : block.daypart === 'PM'
          ? t(locale, 'afternoon')
          : t(locale, 'evening')
  }

  // Bottom time-range strip — only when the user (or AI) actually committed
  // explicit times. We deliberately do NOT fabricate a range from the daypart
  // for flexible blocks: the whole point of "灵活" is to NOT pin a time.
  const bottomRange =
    !isFlexible && block.startTime && block.endTime
      ? `${block.startTime} - ${block.endTime}`
      : undefined

  // ---------- evidence badges ----------------------------------------------
  const ev = block.evidence
  const weatherRisk =
    ev?.weatherFit !== undefined && ev.weatherFit < 50
      ? true
      : ev?.weatherSummary && /雨|rain|storm|雷|雪|snow/i.test(ev.weatherSummary) && block.place?.indoor === false
        ? true
        : false

  return (
    <SelectableCard
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      selected={selected}
      locked={block.locked}
      className={`group relative bg-white/90 p-3.5 shadow-sm hover:-translate-y-0.5 hover:shadow-card ${
        block.locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        block.optional ? 'opacity-95' : ''
      } ${
        dragging ? 'grayscale ring-1 ring-brand-200/70' : ''
      }`}
      {...(!block.locked ? attributes : {})}
      {...(!block.locked ? listeners : {})}
    >
      {/* Top row: time on left -------------------------------------------- */}
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-500">
        {!block.locked && isFlexible ? (
          <button
            type="button"
            className="rounded-full px-1.5 py-0.5 font-semibold text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            title={
              nextManualDaypart(block.daypart) === 'ANY'
                ? t(locale, 'daypartFlexible')
                : nextManualDaypart(block.daypart) === 'AM'
                  ? t(locale, 'morning')
                  : nextManualDaypart(block.daypart) === 'PM'
                    ? t(locale, 'afternoon')
                    : t(locale, 'evening')
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setDaypartBoundary(dayId, block.id, nextManualDaypart(block.daypart))
            }}
          >
            {topTime}
          </button>
        ) : (
          <span
            className={`font-semibold ${isPrecise ? 'text-ink-900 tabular-nums' : isWindow ? 'text-ink-700 tabular-nums' : 'text-ink-700'}`}
          >
            {topTime}
          </span>
        )}
        <div className="flex items-center gap-1">
          {weatherRisk && (
            <span className="text-amber-600" title={t(locale, 'riskWeather')}>
              <WarnGlyph />
            </span>
          )}
          {block.locked && (
            <span className="text-amber-600" title={block.lockReason || t(locale, 'lockedTip')}>
              <LockGlyph />
            </span>
          )}
        </div>
      </div>

      {/* Title row -------------------------------------------------------- */}
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 text-sm leading-5">{KIND_GLYPH[block.kind] ?? '·'}</span>
        <div className="min-w-0 flex-1 pr-12">
          <div className="truncate text-sm font-semibold text-ink-900">
            {block.title || (locale === 'zh' ? '未命名' : 'Untitled')}
          </div>
        </div>
      </div>

      {/* Chip row: keep only decision-critical metadata on the card. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <span className={granChip}>{granLabel}</span>
        {weatherRisk && <span className="chip-amber">{t(locale, 'riskWeather')}</span>}
        {ev?.closedOnDate && <span className="chip-red">{t(locale, 'closed')}</span>}
      </div>

      {/* Sub info: place/notes (single short line) ------------------------ */}
      {block.place?.name && block.place.name !== block.title && (
        <div className="mt-2 truncate text-caption text-ink-500">{block.place.name}</div>
      )}
      {!block.place?.name && block.notes && (
        <div className="mt-2 line-clamp-2 text-caption text-ink-500">{block.notes}</div>
      )}

      {/* Bottom time/duration row ---------------------------------------- */}
      <div className="mt-3 flex items-center justify-between border-t border-ink-100/70 pt-2 text-caption text-ink-400">
        <span className="tabular-nums">{bottomRange ?? fmtDuration(block.durationMin, locale)}</span>
        <span className="flex items-center gap-1 tabular-nums">
          {block.optional && <span>{t(locale, 'optional')}</span>}
          {bottomRange ? fmtDuration(block.durationMin, locale) : ''}
        </span>
      </div>

      {/* Actions stay visible on touch-sized viewports. */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        <button
          className="icon-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            toggleLock(dayId, block.id)
          }}
          title={block.locked ? t(locale, 'unlock') : t(locale, 'lock')}
          aria-label={block.locked ? t(locale, 'unlock') : t(locale, 'lock')}
        >
          {block.locked ? <UnlockGlyph /> : <LockGlyph />}
        </button>
        <button
          className="icon-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          title={t(locale, 'edit')}
          aria-label={t(locale, 'edit')}
        >
          <EditGlyph />
        </button>
        <button
          className="icon-btn hover:bg-red-50 hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            removeBlock(dayId, block.id)
          }}
          title={t(locale, 'delete')}
          aria-label={t(locale, 'delete')}
        >
          <CloseGlyph />
        </button>
      </div>

      {/* Drag handle on left edge ---------------------------------------- */}
      {!block.locked && (
        <button
          className="pointer-events-none absolute -left-1 top-1/2 flex h-7 w-3 -translate-y-1/2 items-center justify-center rounded text-ink-300 opacity-100 transition md:opacity-0 md:group-hover:opacity-100"
          aria-label="drag"
        >
          ⋮
        </button>
      )}
    </SelectableCard>
  )
}

/* ---------------------- inline icons ---------------------- */
function svgProps() {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}
function LockGlyph() {
  return (
    <svg className="h-3.5 w-3.5" {...svgProps()}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
function UnlockGlyph() {
  return (
    <svg className="h-3.5 w-3.5" {...svgProps()}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0" />
    </svg>
  )
}
function EditGlyph() {
  return (
    <svg className="h-3.5 w-3.5" {...svgProps()}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}
function CloseGlyph() {
  return (
    <svg className="h-3.5 w-3.5" {...svgProps()}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function WarnGlyph() {
  return (
    <svg className="h-3.5 w-3.5" {...svgProps()}>
      <path d="M12 2 1 21h22L12 2z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  )
}
