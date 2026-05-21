import { useEffect, useMemo, useRef, useState } from 'react'
import { useTripStore } from '../store/trip'
import { geocode } from '../lib/weather'
import type { Block } from '../types'

export interface GeocodeTarget {
  containerId: string
  block: Block
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
            `${containerId}:${block.id}:${block.place?.name ?? ''}:${block.place?.address ?? ''}:${block.place?.lat ?? ''}:${block.place?.lng ?? ''}`,
        )
        .join('|'),
    [targets],
  )

  useEffect(() => {
    let cancelled = false
    const todo = latestTargets.current.filter(
      ({ block }) =>
        block.place?.name &&
        (block.place.lat === undefined || block.place.lng === undefined),
    )
    if (todo.length === 0) {
      setGeocoding(false)
      return
    }

    setGeocoding(true)
    ;(async () => {
      for (const { containerId, block } of todo) {
        if (cancelled) return
        const q = [block.place?.name, block.place?.address].filter(Boolean).join(', ')
        try {
          const hit = await geocode(q)
          if (cancelled) return
          if (hit) {
            patchBlock(containerId, block.id, {
              place: { ...block.place, name: block.place?.name ?? '', lat: hit.lat, lng: hit.lng },
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
