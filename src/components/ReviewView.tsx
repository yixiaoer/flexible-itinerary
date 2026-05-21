import { useMemo } from 'react'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { shortDateLabel, weekdayLabel, fmtDuration } from '../lib/time'
import type { Tab } from '../App'
import { PageHeader } from './layout'
import { Alert, BlankState, Button, Card, DataTable, type DataTableColumn, StatTile } from './ui'

interface Props {
  onSwitchTab: (tab: Tab) => void
}

export function ReviewView({ onSwitchTab }: Props) {
  const trip = useTripStore((s) => s.trip)
  const locale = useSettings((s) => s.locale)

  const summary = useMemo(() => {
    const blocks = trip?.days.flatMap((d) => d.blocks) ?? []
    return {
      total: blocks.length,
      locked: blocks.filter((b) => b.locked).length,
      window: blocks.filter((b) => b.granularity === 'window').length,
      flexible: blocks.filter((b) => b.granularity === 'flexible').length,
      precise: blocks.filter((b) => b.granularity === 'precise').length,
      weatherChecked: trip?.days.filter((d) =>
        d.blocks.some((b) => b.evidence?.weatherSummary),
      ).length ?? 0,
    }
  }, [trip])

  const issues = useMemo(() => {
    if (!trip) return [] as Array<{ dayIndex: number; date?: string; blockId: string; title: string; message: string; severity: 'medium' | 'high' }>
    const out: Array<{ dayIndex: number; date?: string; blockId: string; title: string; message: string; severity: 'medium' | 'high' }> = []
    for (const d of trip.days) {
      for (const b of d.blocks) {
        const ev = b.evidence
        if (ev?.closedOnDate) {
          out.push({
            dayIndex: d.index,
            date: d.date,
            blockId: b.id,
            title: b.title,
            message: t(locale, 'closed'),
            severity: 'high',
          })
        }
        if (ev?.weatherFit !== undefined && ev.weatherFit < 30) {
          out.push({
            dayIndex: d.index,
            date: d.date,
            blockId: b.id,
            title: b.title,
            message: ev.weatherSummary
              ? `${t(locale, 'riskWeather')} · ${ev.weatherSummary}`
              : t(locale, 'riskWeather'),
            severity: 'high',
          })
        } else if (ev?.weatherFit !== undefined && ev.weatherFit < 60) {
          out.push({
            dayIndex: d.index,
            date: d.date,
            blockId: b.id,
            title: b.title,
            message: ev.weatherSummary
              ? `${t(locale, 'fitWarn')} · ${ev.weatherSummary}`
              : t(locale, 'fitWarn'),
            severity: 'medium',
          })
        }
        if (ev?.notes && ev.notes.length > 0) {
          for (const note of ev.notes) {
            out.push({
              dayIndex: d.index,
              date: d.date,
              blockId: b.id,
              title: b.title,
              message: note,
              severity: 'medium',
            })
          }
        }
      }
    }
    return out
  }, [trip, locale])

  if (!trip) {
    return (
      <BlankState className="min-h-[60vh]" title={t(locale, 'emptyTitle')} />
    )
  }

  const issueColumns: Array<DataTableColumn<(typeof issues)[number]>> = [
    {
      key: 'severity',
      header: locale === 'zh' ? '级别' : 'Severity',
      render: (iss) => (
        <span className={iss.severity === 'high' ? 'chip-red' : 'chip-amber'}>
          {iss.severity === 'high' ? t(locale, 'riskHigh') : t(locale, 'riskMedium')}
        </span>
      ),
    },
    {
      key: 'date',
      header: locale === 'zh' ? '日期' : 'Date',
      render: (iss) => (
        <span className="text-ink-500">
          {iss.date ? shortDateLabel(iss.date, locale) : t(locale, 'dayBadge')(iss.dayIndex)}
          {iss.date && ` · ${weekdayLabel(iss.date, locale)}`}
        </span>
      ),
    },
    {
      key: 'item',
      header: locale === 'zh' ? '活动' : 'Item',
      render: (iss) => (
        <div>
          <div className="font-medium text-ink-900">{iss.title}</div>
          <div className="mt-0.5 text-sm text-ink-600">{iss.message}</div>
        </div>
      ),
    },
  ]

  const dayColumns: Array<DataTableColumn<(typeof trip.days)[number]>> = [
    {
      key: 'day',
      header: locale === 'zh' ? '日期' : 'Day',
      render: (d) => (
        <div className="font-medium text-ink-900">
          {t(locale, 'dayBadge')(d.index)}
          {d.date && (
            <span className="ml-2 font-normal text-ink-500">
              {shortDateLabel(d.date, locale)} · {weekdayLabel(d.date, locale)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: locale === 'zh' ? '活动' : 'Items',
      render: (d) => <span className="chip-gray">{d.blocks.length} {locale === 'zh' ? '项' : 'items'}</span>,
    },
    {
      key: 'duration',
      header: t(locale, 'duration'),
      render: (d) => {
        const dur = d.blocks.reduce((s, b) => s + (b.durationMin ?? 0), 0)
        return <span className="chip-gray">{fmtDuration(dur, locale)}</span>
      },
    },
    {
      key: 'status',
      header: locale === 'zh' ? '状态' : 'Status',
      render: (d) => d.blocks.some((b) => b.locked) ? <span className="chip-amber">{t(locale, 'locked')}</span> : <span className="text-caption text-ink-400">-</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t(locale, 'reviewTitle')}
        description={t(locale, 'reviewSubtitle')}
        actions={
          <Button variant="outline" onClick={() => onSwitchTab('board')}>
            ← {t(locale, 'tabBoard')}
          </Button>
        }
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t(locale, 'reviewTotalBlocks')} value={summary.total} />
          <StatTile label={t(locale, 'reviewLockedBlocks')} value={summary.locked} accent="amber" />
          <StatTile label={t(locale, 'reviewWindowBlocks')} value={summary.window} accent="blue" />
          <StatTile
            label={t(locale, 'reviewWeatherChecked')}
            value={`${summary.weatherChecked}/${trip.days.length}`}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-ink-900">{t(locale, 'reviewIssues')}</h3>
        {issues.length === 0 ? (
          <Alert variant="success">{t(locale, 'reviewNoIssues')}</Alert>
        ) : (
          <DataTable
            columns={issueColumns}
            rows={issues}
            getRowKey={(iss, i) => `${iss.blockId}-${i}`}
          />
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-ink-900">{t(locale, 'reviewByDay')}</h3>
        <DataTable columns={dayColumns} rows={trip.days} getRowKey={(d) => d.id} />
      </Card>
    </div>
  )
}
