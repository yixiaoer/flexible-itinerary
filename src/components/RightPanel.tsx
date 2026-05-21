import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { UNSCHEDULED_ID, type Block, type Day } from '../types'
import { fmtDuration, shortDateLabel, weekdayLabel } from '../lib/time'
import { DAY_PIN_PALETTE, makeMapPinIcon, MAP_PIN_COLORS } from '../lib/mapPins'
import { useGeocodeBlocks } from '../hooks/useGeocodeBlocks'
import { Alert, BlankState, Card } from './ui'

interface Props {
  selectedBlockId: string | null
}

interface Pin {
  block: Block
  day: Day | null
  lat: number
  lng: number
  color: string
  index: number
}

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 12)
      return
    }
    const b = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(b, { padding: [30, 30] })
  }, [map, pins])
  return null
}

export function RightPanel({ selectedBlockId }: Props) {
  const trip = useTripStore((s) => s.trip)
  const locale = useSettings((s) => s.locale)

  // We pin everything that has lat/lng on the map: scheduled blocks AND
  // candidates pool (so users can preview where unscheduled places sit).
  const allBlocks = useMemo(() => {
    if (!trip) return [] as Array<{ day: Day | null; block: Block; idx: number; containerId: string }>
    let n = 0
    const scheduled = trip.days.flatMap((d) =>
      d.blocks.map((b) => {
        n += 1
        return { day: d as Day | null, block: b, idx: n, containerId: d.id }
      }),
    )
    const unscheduled = trip.unscheduled.map((b) => {
      n += 1
      return { day: null as Day | null, block: b, idx: n, containerId: UNSCHEDULED_ID }
    })
    return [...scheduled, ...unscheduled]
  }, [trip])

  const geocoding = useGeocodeBlocks(allBlocks)

  const pins: Pin[] = useMemo(
    () =>
      allBlocks
        .filter(
          ({ block }) =>
            typeof block.place?.lat === 'number' &&
            typeof block.place?.lng === 'number',
        )
        .map(({ block, day, idx }) => ({
          block,
          day,
          lat: block.place!.lat!,
          lng: block.place!.lng!,
          color: day ? DAY_PIN_PALETTE[(day.index - 1) % DAY_PIN_PALETTE.length] : MAP_PIN_COLORS.gray,
          index: idx,
        })),
    [allBlocks],
  )

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

  const center: [number, number] = pins[0]
    ? [pins[0].lat, pins[0].lng]
    : [35.6764, 139.65] // Tokyo fallback

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Mini map */}
      <div className="surface-glass relative h-[320px] overflow-hidden">
        <MapContainer
          center={center}
          zoom={11}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OSM'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds pins={pins} />
          {pins.map((p) => (
            <Marker
              key={p.block.id}
              position={[p.lat, p.lng]}
              icon={makeMapPinIcon(p.color, p.index)}
            />
          ))}
        </MapContainer>
        {geocoding && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-caption text-ink-500 shadow-sm">
            {locale === 'zh' ? '解析地点中…' : 'Geocoding…'}
          </div>
        )}
      </div>

      {/* Selected block detail */}
      <DetailCard selected={selected} />
    </div>
  )
}

function DetailCard({ selected }: { selected: { day: Day | null; block: Block } | null }) {
  const locale = useSettings((s) => s.locale)

  if (!selected) {
    return (
      <BlankState className="flex-1 bg-white/80" title={t(locale, 'selectACard')} />
    )
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
