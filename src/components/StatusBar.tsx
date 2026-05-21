import { useMemo } from 'react'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { Button, Card } from './ui'

interface Props {
  onReview: () => void
}

export function StatusBar({ onReview }: Props) {
  const trip = useTripStore((s) => s.trip)
  const locale = useSettings((s) => s.locale)

  const stats = useMemo(() => {
    const dayBlocks = trip?.days.flatMap((d) => d.blocks) ?? []
    const locked = dayBlocks.filter((b) => b.locked).length
    const window = dayBlocks.filter((b) => b.granularity === 'window').length
    const flexible = dayBlocks.filter((b) => b.granularity === 'flexible').length
    const optional = dayBlocks.filter((b) => b.optional).length
    const risk = dayBlocks.filter((b) => {
      const ev = b.evidence
      if (ev?.closedOnDate) return true
      if (ev?.weatherFit !== undefined && ev.weatherFit < 50) return true
      return false
    }).length
    const candidates = trip?.unscheduled.length ?? 0
    return { locked, window, flexible, optional, risk, candidates }
  }, [trip])

  if (!trip) return null

  const items: { tone: string; label: string; count: number }[] = [
    { tone: 'chip-red', label: t(locale, 'statRisk'), count: stats.risk },
    { tone: 'chip-brand', label: t(locale, 'statCandidates'), count: stats.candidates },
    { tone: 'chip-amber', label: t(locale, 'statLocked'), count: stats.locked },
    { tone: 'chip-blue', label: t(locale, 'statWindow'), count: stats.window },
    { tone: 'chip-green', label: t(locale, 'statFlexible'), count: stats.flexible },
    { tone: 'chip-gray', label: t(locale, 'statOptional'), count: stats.optional },
  ].filter((it) => it.count > 0)

  return (
    <Card padded={false} className="mt-3 flex flex-col gap-2 bg-white/76 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink-900">
          {trip.days.length} {locale === 'zh' ? '天' : trip.days.length === 1 ? 'day' : 'days'} ·{' '}
          {trip.days.flatMap((d) => d.blocks).length} {locale === 'zh' ? '项活动' : 'items'}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {items.length === 0 ? (
            <span className="text-caption text-ink-400">
              {locale === 'zh' ? '暂无锁定、风险或候选项' : 'No locks, risks, or candidates yet'}
            </span>
          ) : (
            items.map((it) => (
              <span key={it.label} className={it.tone}>
                <span>{it.label}</span>
                <span className="tabular-nums">{it.count}</span>
              </span>
            ))
          )}
        </div>
      </div>
      <Button variant="outline" className="sm:ml-auto" onClick={onReview}>
        {t(locale, 'viewReview')} →
      </Button>
    </Card>
  )
}
