import { useMemo } from 'react'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { type Block, type Day } from '../types'
import { fmtDuration, shortDateLabel, weekdayLabel } from '../lib/time'
import { Alert, Card } from './ui'

interface Props {
  selectedBlockId: string | null
}

export function RightPanel({ selectedBlockId }: Props) {
  const trip = useTripStore((s) => s.trip)

  const selected = useMemo(() => {
    if (!trip || !selectedBlockId) return null
    for (const d of trip.days) {
      const b = d.blocks.find((x) => x.id === selectedBlockId)
      if (b) return { day: d as Day | null, block: b }
    }
    const inPool = trip.unscheduled.find((b) => b.id === selectedBlockId)
    if (inPool) return { day: null as Day | null, block: inPool }
    return null
  }, [trip, selectedBlockId])

  return <DetailCard selected={selected} />
}

function DetailCard({ selected }: { selected: { day: Day | null; block: Block } | null }) {
  const locale = useSettings((s) => s.locale)

  if (!selected) {
    return null
  }

  const { block, day } = selected
  const ev = block.evidence
  const dateLabel = day
    ? day.date
      ? `${shortDateLabel(day.date, locale)}${locale === 'zh' ? `（${weekdayLabel(day.date, locale)}）` : ` · ${weekdayLabel(day.date, locale)}`}`
      : t(locale, 'dayBadge')(day.index)
    : t(locale, 'candidatesTitle')

  // For flexible blocks we always show the daypart label, never explicit
  // times — even if stale times are still on the object — so the UI matches
  // the "no fixed time" promise of the 灵活 tag.
  const timeLabel =
    block.granularity === 'flexible'
      ? block.daypart === 'ANY'
        ? t(locale, 'daypartFlexible')
        : block.daypart === 'AM'
          ? t(locale, 'morning')
          : block.daypart === 'PM'
            ? t(locale, 'afternoon')
            : t(locale, 'evening')
      : block.startTime && block.endTime
        ? `${block.startTime} - ${block.endTime}`
        : '—'

  // Compute risk level
  const riskLevel: 'low' | 'medium' | 'high' = (() => {
    const f = ev?.weatherFit
    if (f === undefined && !ev?.closedOnDate) return 'low'
    if (ev?.closedOnDate) return 'high'
    if (f !== undefined && f < 30) return 'high'
    if (f !== undefined && f < 60) return 'medium'
    return 'low'
  })()

  const riskTone = {
    low: 'chip-green',
    medium: 'chip-amber',
    high: 'chip-red',
  }[riskLevel]
  const riskLabel = {
    low: t(locale, 'riskLow'),
    medium: t(locale, 'riskMedium'),
    high: t(locale, 'riskHigh'),
  }[riskLevel]

  const granLabel =
    block.granularity === 'precise'
      ? t(locale, 'gPrecise')
      : block.granularity === 'window'
        ? t(locale, 'gWindow')
        : t(locale, 'gFlexible')

  return (
    <Card padded={false} className="flex flex-1 flex-col overflow-hidden bg-white/80">
      <div className="space-y-4 px-5 py-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink-900">{block.title}</h3>
          {block.place?.name && block.place.name !== block.title && (
            <div className="mt-0.5 text-xs text-ink-500">{block.place.name}</div>
          )}
          <div className="mt-1 text-xs text-ink-500">
            {dateLabel} · {timeLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className="chip-brand">{granLabel}</span>
          {block.locked && <span className="chip-amber">🔒 {t(locale, 'locked')}</span>}
          {block.optional && <span className="chip-gray">{t(locale, 'optional')}</span>}
          {ev?.weatherSummary && (
            <span className="chip-blue">🌤 {ev.weatherSummary}</span>
          )}
          {ev?.closedOnDate && (
            <span className="chip-red">{t(locale, 'closed')}</span>
          )}
        </div>

        {block.place?.intro && (
          <p className="text-sm leading-relaxed text-ink-600">{block.place.intro}</p>
        )}

        {block.notes && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            {block.notes}
          </div>
        )}

        {block.lockReason && block.locked && (
          <Alert variant="warning" className="text-xs">{block.lockReason}</Alert>
        )}

        <div className="rounded-2xl border border-ink-200/80 bg-white/60 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500">{t(locale, 'riskLevel')}</span>
            <span className={riskTone}>{riskLabel}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-ink-500">{t(locale, 'duration')}</span>
            <span className="tabular-nums text-ink-700">{fmtDuration(block.durationMin, locale)}</span>
          </div>
          {ev?.notes && ev.notes.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-ink-500">{t(locale, 'alternatives')}</div>
              <ul className="mt-1 space-y-1 text-xs text-ink-600">
                {ev.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
