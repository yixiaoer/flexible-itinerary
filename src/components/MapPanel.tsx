import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { UNSCHEDULED_ID, type Block, type Day } from '../types'
import { makeMapPinIcon, MAP_PIN_COLORS } from '../lib/mapPins'
import { useGeocodeBlocks } from '../hooks/useGeocodeBlocks'
import { PageHeader } from './layout'
import { Button, Card, ErrorState, LoadingState } from './ui'
import { geocode, type GeocodeHit } from '../lib/weather'
import { makeEmptyBlock } from '../lib/planner'

interface PinPoint {
  block: Block
  day: Day | null
  lat: number
  lng: number
}

function FitBounds({ points }: { points: PinPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, points])
  return null
}

function FocusSearchHit({ hit }: { hit: GeocodeHit | null }) {
  const map = useMap()
  useEffect(() => {
    if (!hit) return
    map.setView([hit.lat, hit.lng], 13)
  }, [hit, map])
  return null
}

export function MapPanel() {
  const trip = useTripStore((s) => s.trip)
  const addBlock = useTripStore((s) => s.addBlock)
  const locale = useSettings((s) => s.locale)

  const [filterDay, setFilterDay] = useState<string | 'all'>('all')
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchHit, setSearchHit] = useState<GeocodeHit | null>(null)

  const allBlocks = useMemo(() => {
    if (!trip) return [] as Array<{ day: Day | null; block: Block; containerId: string }>
    const scheduled = trip.days.flatMap((d) =>
      d.blocks.map((b) => ({ day: d as Day | null, block: b, containerId: d.id })),
    )
    const candidates = trip.unscheduled.map((b) => ({
      day: null as Day | null,
      block: b,
      containerId: UNSCHEDULED_ID,
    }))
    return [...scheduled, ...candidates]
  }, [trip])

  const geocoding = useGeocodeBlocks(allBlocks)

  const points: PinPoint[] = useMemo(() => {
    return allBlocks
      .filter(
        ({ block }) =>
          typeof block.place?.lat === 'number' && typeof block.place?.lng === 'number',
      )
      .filter(({ day }) =>
        filterDay === 'all' ||
        (filterDay === UNSCHEDULED_ID ? day === null : day?.id === filterDay),
      )
      .map(({ block, day }) => ({
        block,
        day,
        lat: block.place!.lat!,
        lng: block.place!.lng!,
      }))
  }, [allBlocks, filterDay])

  if (!trip) return null

  const center: [number, number] = searchHit
    ? [searchHit.lat, searchHit.lng]
    : points[0]
      ? [points[0].lat, points[0].lng]
      : [35.0, 135.0]
  const resolvedLabel = `${points.length}/${allBlocks.length} ${
    locale === 'zh' ? '个地点已解析' : 'places resolved'
  }`
  const searchLabel = locale === 'zh' ? '搜索地点' : 'Search place'
  const candidatesLabel = t(locale, 'candidatesTitle')

  const runSearch = async () => {
    const q = searchText.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const hit = await geocode(q)
      if (!hit) {
        setSearchHit(null)
        setSearchError(locale === 'zh' ? '没有找到这个地点' : 'Place not found.')
        return
      }
      setSearchHit(hit)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }

  const addSearchHitToCandidates = () => {
    if (!searchHit) return
    addBlock(UNSCHEDULED_ID, {
      ...makeEmptyBlock(),
      title: searchText.trim() || searchHit.name,
      place: {
        name: searchHit.name,
        address: [searchHit.admin1, searchHit.country].filter(Boolean).join(', '),
        lat: searchHit.lat,
        lng: searchHit.lng,
      },
    })
    setFilterDay('all')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t(locale, 'tabMap')}
        description={locale === 'zh' ? '查看每天安排的地理分布与地点解析状态。' : 'Review the trip spatially and check geocoding coverage.'}
        meta={
          <>
            <span className="chip-brand">{resolvedLabel}</span>
            {geocoding && <span className="chip-blue">{locale === 'zh' ? '解析中' : 'Geocoding'}</span>}
          </>
        }
      />

      <Card className="flex flex-wrap items-center gap-3" padded>
        <select
          className="input max-w-[280px]"
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
        >
          <option value="all">{locale === 'zh' ? '全部日期' : 'All days'}</option>
          <option value={UNSCHEDULED_ID}>{candidatesLabel}</option>
          {trip.days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.date ?? t(locale, 'dayBadge')(d.index)}
            </option>
          ))}
        </select>
        {geocoding && (
          <LoadingState
            title={locale === 'zh' ? '正在解析地点经纬度…' : 'Geocoding places…'}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        )}
        <span className="ml-auto text-xs text-ink-500">
          {resolvedLabel}
        </span>
      </Card>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-start" padded>
        <form
          className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void runSearch()
          }}
        >
          <input
            className="input min-w-0"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={locale === 'zh' ? '直接搜索地点，比如：清水寺 / Gion / 东京塔' : 'Search a place, e.g. Kiyomizu-dera / Gion / Tokyo Tower'}
          />
          <Button type="submit" variant="primary" disabled={searching || !searchText.trim()}>
            {searching ? (locale === 'zh' ? '搜索中…' : 'Searching…') : searchLabel}
          </Button>
        </form>
        {searchHit && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-3 py-2 text-sm text-ink-700">
            <div className="font-semibold text-ink-900">{searchHit.name}</div>
            <div className="text-caption text-ink-500">
              {[searchHit.admin1, searchHit.country].filter(Boolean).join(', ')}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={addSearchHitToCandidates}>
              {locale === 'zh' ? '加入候选池' : 'Add to candidates'}
            </Button>
          </div>
        )}
        {searchError && <ErrorState className="sm:max-w-xs" message={searchError} />}
      </Card>

      <div className="surface h-[calc(100vh-220px)] min-h-[420px] overflow-hidden">
        <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          <FocusSearchHit hit={searchHit} />
          {searchHit && (
            <Marker
              key={`search-${searchHit.lat}-${searchHit.lng}`}
              position={[searchHit.lat, searchHit.lng]}
              icon={makeMapPinIcon(MAP_PIN_COLORS.blue)}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{searchHit.name}</div>
                  <div className="text-xs text-ink-500">
                    {[searchHit.admin1, searchHit.country].filter(Boolean).join(', ')}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
          {points.map((p) => (
            <Marker
              key={p.block.id}
              position={[p.lat, p.lng]}
              icon={makeMapPinIcon(
                p.day === null ? MAP_PIN_COLORS.gray : p.block.locked ? MAP_PIN_COLORS.amber : MAP_PIN_COLORS.brand,
              )}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{p.block.title}</div>
                  <div className="text-xs text-ink-500">
                    {p.day ? p.day.date ?? t(locale, 'dayBadge')(p.day.index) : candidatesLabel}
                  </div>
                  {p.block.place?.intro && (
                    <div className="text-xs text-ink-600">{p.block.place.intro}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
