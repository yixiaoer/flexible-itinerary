import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useSettings } from '../store/settings'
import { useTripStore } from '../store/trip'
import { useGeocodeBlocks } from '../hooks/useGeocodeBlocks'
import { DAY_PIN_PALETTE, makeMapPinIcon, MAP_PIN_COLORS } from '../lib/mapPins'
import { UNSCHEDULED_ID, type Block, type Day } from '../types'

interface Pin {
  block: Block
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
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, pins])
  return null
}

export function TripMiniMap({ className = '' }: { className?: string }) {
  const trip = useTripStore((s) => s.trip)
  const locale = useSettings((s) => s.locale)

  const allBlocks = useMemo(() => {
    if (!trip) return [] as Array<{ day: Day | null; block: Block; idx: number; containerId: string }>
    let index = 0
    const scheduled = trip.days.flatMap((day) =>
      day.blocks.map((block) => {
        index += 1
        return { day: day as Day | null, block, idx: index, containerId: day.id }
      }),
    )
    const unscheduled = trip.unscheduled.map((block) => {
      index += 1
      return { day: null as Day | null, block, idx: index, containerId: UNSCHEDULED_ID }
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
          lat: block.place!.lat!,
          lng: block.place!.lng!,
          color: day ? DAY_PIN_PALETTE[(day.index - 1) % DAY_PIN_PALETTE.length] : MAP_PIN_COLORS.gray,
          index: idx,
        })),
    [allBlocks],
  )

  const center: [number, number] = pins[0]
    ? [pins[0].lat, pins[0].lng]
    : [35.6764, 139.65]

  return (
    <div className={`surface-glass relative h-52 overflow-hidden ${className}`}>
      <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OSM'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} />
        {pins.map((pin) => (
          <Marker
            key={pin.block.id}
            position={[pin.lat, pin.lng]}
            icon={makeMapPinIcon(pin.color, pin.index)}
          />
        ))}
      </MapContainer>
      {geocoding && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-caption text-ink-500 shadow-sm">
          {locale === 'zh' ? '解析地点中…' : 'Geocoding…'}
        </div>
      )}
    </div>
  )
}
