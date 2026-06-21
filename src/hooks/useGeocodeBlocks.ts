import { useEffect, useMemo, useRef, useState } from 'react'
import { useTripStore } from '../store/trip'
import { geocode } from '../lib/weather'
import type { Block } from '../types'

export interface GeocodeTarget {
  containerId: string
  block: Block
}

function geocodeQueryFor(block: Block): string {
  // Prefer the structured place name; fall back to the user-visible title so
  // manually-added candidates (which start with an empty place.name) still
  // get geocoded automatically.
  const primary = block.place?.name?.trim() || block.title?.trim() || ''
  if (!primary) return ''
  const address = block.place?.address?.trim()
  return address ? `${primary}, ${address}` : primary
}

export function useGeocodeBlocks(targets: GeocodeTarget[]) {
  const patchBlock = useTripStore((s) => s.patchBlock)
  const [geocoding, setGeocoding] = useState(false)
  const latestTargets = useRef(targets)
  latestTargets.current = targets
  const targetKey = useMemo(
    () =>
      targets
        .map(
          ({ containerId, block }) =>
            `${containerId}:${block.id}:${block.title}:${block.place?.name ?? ''}:${block.place?.address ?? ''}:${block.place?.lat ?? ''}:${block.place?.lng ?? ''}`,
        )
        .join('|'),
    [targets],
  )

  useEffect(() => {
    let cancelled = false
    const todo = latestTargets.current.filter(
      ({ block }) =>
        geocodeQueryFor(block) &&
        (block.place?.lat === undefined || block.place?.lng === undefined),
    )
    if (todo.length === 0) {
      setGeocoding(false)
      return
    }

    setGeocoding(true)
    ;(async () => {
      for (const { containerId, block } of todo) {
        if (cancelled) return
        const q = geocodeQueryFor(block)
        try {
          const hit = await geocode(q)
          if (cancelled) return
          if (hit) {
            patchBlock(containerId, block.id, {
              place: {
                ...block.place,
                // Keep whatever the user already wrote into the structured
                // place name; do NOT overwrite with the geocoder's preferred
                // label, since they may have intentionally translated it.
                name: block.place?.name ?? '',
                lat: hit.lat,
                lng: hit.lng,
              },
            })
          }
        } catch {
          // Best-effort geocoding should not block the planning UI.
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      if (!cancelled) setGeocoding(false)
    })()

    return () => {
      cancelled = true
    }
  }, [patchBlock, targetKey])

  return geocoding
}
