import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Block, Day } from '../types'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { BlockCard } from './BlockCard'
import { shortDateLabel, weekdayLabel } from '../lib/time'
import { makeEmptyBlock } from '../lib/planner'
import { Button, CountBadge, PanelHeader } from './ui'

interface Props {
  day: Day
  selectedBlockId: string | null
  onSelect: (id: string | null) => void
  onEdit: (b: Block) => void
  onReplanDay: () => void
  onClearDay: () => void
  onRemoveDay: () => void
  dropIndex?: number | null
  activeBlockId?: string | null
}

const WEATHER_GLYPH: Record<string, string> = {
  // Map a coarse weather summary keyword to an icon.
  晴: '☀',
  Clear: '☀',
  多云: '⛅',
  cloud: '⛅',
  阴: '☁',
  Overcast: '☁',
  雨: '🌧',
  rain: '🌧',
  Rain: '🌧',
  雪: '❄',
  snow: '❄',
}

function weatherGlyph(summary?: string): string {
  if (!summary) return ''
  for (const k of Object.keys(WEATHER_GLYPH)) {
    if (summary.includes(k)) return WEATHER_GLYPH[k]
  }
  return '·'
}

function tempPart(summary?: string): string {
  if (!summary) return ''
  const m = /(-?\d+)[–-](-?\d+)°C/.exec(summary)
  if (m) return `${m[2]}°`
  const single = /(-?\d+)°C/.exec(summary)
  return single ? `${single[1]}°` : ''
}

export function DayColumn({
  day,
  selectedBlockId,
  onSelect,
  onEdit,
  onReplanDay,
  onClearDay,
  onRemoveDay,
  dropIndex,
  activeBlockId,
}: Props) {
  const locale = useSettings((s) => s.locale)
  const addBlock = useTripStore((s) => s.addBlock)
  const { setNodeRef, isOver } = useDroppable({ id: day.id })

  const sorted = day.blocks

  const dayWeather = day.blocks.find((b) => b.evidence?.weatherSummary)?.evidence?.weatherSummary
  const wIcon = weatherGlyph(dayWeather)
  const wTemp = tempPart(dayWeather)

  const dateMain = day.date
    ? `${shortDateLabel(day.date, locale)}${locale === 'zh' ? `（${weekdayLabel(day.date, locale)}）` : ` · ${weekdayLabel(day.date, locale)}`}`
    : ''

  return (
    <div
      ref={setNodeRef}
      className={`surface-glass flex min-h-[260px] flex-col overflow-hidden transition ${
        isOver ? 'border-brand-300 ring-2 ring-brand-100' : ''
      }`}
    >
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            {t(locale, 'dayBadge')(day.index)}
            <CountBadge>{sorted.length}</CountBadge>
          </span>
        }
        meta={
          (wIcon || wTemp) && (
            <span className="ml-auto flex items-center gap-1 text-xs text-ink-500">
              <span>{wIcon}</span>
              <span className="tabular-nums">{wTemp}</span>
            </span>
          )
        }
        actions={
          <>
            <button
              className="icon-btn"
              onClick={onReplanDay}
              title={t(locale, 'replanThisDay')}
              aria-label={t(locale, 'replanThisDay')}
            >
              <SparkleGlyph />
            </button>
            <button
              className="icon-btn"
              onClick={onClearDay}
              title={t(locale, 'clearDay')}
              aria-label={t(locale, 'clearDay')}
              disabled={sorted.length === 0}
            >
              <ClearGlyph />
            </button>
            <button
              className="icon-btn"
              onClick={onRemoveDay}
              title={t(locale, 'removeDay')}
              aria-label={t(locale, 'removeDay')}
            >
              <TrashGlyph />
            </button>
          </>
        }
      />
      <header className="px-4 pb-3 pt-2">
        <div className="min-w-0 flex-1">
          {dateMain && (
            <div className="text-caption font-medium text-ink-500">{dateMain}</div>
          )}
        </div>
      </header>

      <div className="flex-1 px-3.5 pb-3.5">
        <SortableContext items={sorted.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-200/70 bg-white/50 px-4 py-8 text-center">
              {dropIndex === 0 && <DropIndicator />}
              <div className="text-sm font-medium text-ink-400">{t(locale, 'emptyDay')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((b, index) => (
                <div key={b.id}>
                  {dropIndex === index && <DropIndicator />}
                  <BlockCard
                    dayId={day.id}
                    block={b}
                    selected={selectedBlockId === b.id}
                    onSelect={() => onSelect(b.id)}
                    onEdit={() => onEdit(b)}
                    dragging={activeBlockId === b.id}
                  />
                </div>
              ))}
              {dropIndex === sorted.length && <DropIndicator />}
            </div>
          )}
        </SortableContext>

        <Button
          variant="link"
          className="mt-3 w-full bg-white/50"
          onClick={() => addBlock(day.id, makeEmptyBlock())}
        >
          {t(locale, 'addBlock')}
        </Button>
      </div>
    </div>
  )
}

function DropIndicator() {
  return (
    <div className="relative my-1.5 h-3 rounded-full bg-brand-50/25">
      <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-400/45 via-accent-400/35 to-transparent" />
    </div>
  )
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  )
}

function ClearGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" />
      <path d="M7 16l8-8" />
      <path d="M11 4l5 5" />
      <path d="M5 18l4 2 9-9-6-6-9 9 2 4z" />
    </svg>
  )
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}
