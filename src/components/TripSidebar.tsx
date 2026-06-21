import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../store/settings'
import { useTripStore, newTrip, buildBlankDays } from '../store/trip'
import { generateItinerary, makeEmptyBlock } from '../lib/planner'
import { t, VIBE_PRESET_KEYS } from '../i18n/messages'
import { addDaysISO } from '../lib/time'
import { geocodeOptions, type GeocodeHit } from '../lib/weather'
import type { Block, Trip, TripMeta } from '../types'
import { ChipList } from './ChipList'
import { TripMiniMap } from './TripMiniMap'
import { BrandMark, Button, ErrorState, FormSection, LoadingState, NumberStepper } from './ui'

interface Props {
  onGenerated: () => void
}

const DEFAULT_META: TripMeta = {
  title: '',
  countries: [],
  mustVisit: [],
  vibes: [],
  numDays: 4,
  travelers: 1,
}

type PlaceResolutionStatus = 'pending' | 'resolved' | 'missing'

interface PlaceResolution {
  status: PlaceResolutionStatus
  queryKey: string
  hit?: GeocodeHit
  options: GeocodeHit[]
}

const normalizePlace = (value: string) => value.trim().toLowerCase()

function samePlace(a: string, b: string) {
  return normalizePlace(a) === normalizePlace(b)
}

function sameMetaForm(a: TripMeta, b: TripMeta) {
  return (
    a.countries.join('|') === b.countries.join('|') &&
    a.mustVisit.join('|') === b.mustVisit.join('|') &&
    a.vibes.join('|') === b.vibes.join('|') &&
    a.numDays === b.numDays &&
    a.startDate === b.startDate
  )
}

function geocodeLabel(hit: GeocodeHit) {
  return [hit.admin1, hit.country].filter(Boolean).join(', ')
}

function resolutionFromBlock(place: string, block: Block, queryKey: string): PlaceResolution | undefined {
  const placeKey = normalizePlace(place)
  if (
    block.sourcePlaceKey !== placeKey &&
    !samePlace(block.title, place) &&
    !samePlace(block.place?.name ?? '', place)
  ) {
    return undefined
  }
  if (
    typeof block.place?.lat !== 'number' ||
    typeof block.place?.lng !== 'number'
  ) {
    return undefined
  }
  const hit: GeocodeHit = {
    name: block.place.name || block.title || place,
    admin1: block.place.address,
    lat: block.place.lat,
    lng: block.place.lng,
  }
  return {
    status: 'resolved',
    queryKey,
    hit,
    options: [hit],
  }
}

function storedPlaceResolution(trip: Trip | null, place: string, queryKey: string): PlaceResolution | undefined {
  if (!trip) return undefined
  for (const day of trip.days) {
    for (const block of day.blocks) {
      const resolution = resolutionFromBlock(place, block, queryKey)
      if (resolution) return resolution
    }
  }
  for (const block of trip.unscheduled) {
    const resolution = resolutionFromBlock(place, block, queryKey)
    if (resolution) return resolution
  }
  return undefined
}

function sameResolutionMap(a: Record<string, PlaceResolution>, b: Record<string, PlaceResolution>) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key])
}

function blockFromPlace(name: string, resolution?: PlaceResolution): Block {
  const hit = resolution?.hit
  return {
    ...makeEmptyBlock(),
    title: name,
    sourcePlaceKey: normalizePlace(name),
    place: {
      name: hit?.name ?? name,
      address: hit ? geocodeLabel(hit) : undefined,
      lat: hit?.lat,
      lng: hit?.lng,
    },
  }
}

function applyPlaceResolution(block: Block, resolution?: PlaceResolution): Block {
  const hit = resolution?.hit
  if (!hit) return block
  // Only auto-fill lat/lng/address when not already set. We never overwrite
  // an existing place.name — the user may have intentionally renamed it
  // (e.g. added a Chinese translation).
  const nextAddress = block.place?.address || geocodeLabel(hit)
  const nextLat = block.place?.lat ?? hit.lat
  const nextLng = block.place?.lng ?? hit.lng
  if (
    block.place?.lat === nextLat &&
    block.place?.lng === nextLng &&
    block.place?.address === nextAddress
  ) {
    return block
  }
  return {
    ...block,
    place: {
      ...block.place,
      name: block.place?.name || hit.name,
      address: nextAddress,
      lat: nextLat,
      lng: nextLng,
    },
  }
}

/**
 * Update the mustVisit key when the chip is renamed. If the user never
 * customized the title (it still matches the previous mustVisit string), we
 * also propagate the rename to title/place.name so the candidate stays in
 * sync. Once the user has edited the title we leave it alone — that is the
 * whole point of decoupling them.
 */
function rekeyBlockPlace(block: Block, previousName: string, nextName: string): Block {
  const nextKey = normalizePlace(nextName)
  let next = block
  if (block.sourcePlaceKey !== nextKey) {
    next = { ...next, sourcePlaceKey: nextKey }
  }
  const titleWasPristine = samePlace(block.title, previousName)
  if (titleWasPristine) {
    next = { ...next, title: nextName }
  }
  const placeNameWasPristine = samePlace(block.place?.name ?? '', previousName)
  if (placeNameWasPristine) {
    next = {
      ...next,
      place: {
        ...next.place,
        name: nextName,
      },
    }
  }
  return next
}

function reconcileDays(
  days: Trip['days'],
  numDays: number,
  startDate?: string,
): { days: Trip['days']; removedBlocks: Block[]; changed: boolean } {
  const blankDays = buildBlankDays(numDays, startDate)
  const nextDays = blankDays.map((blank, index) => {
    const existing = days[index]
    if (!existing) return blank
    return {
      ...existing,
      index: index + 1,
      date: startDate ? addDaysISO(startDate, index) : undefined,
    }
  })
  const removedBlocks = days.slice(numDays).flatMap((day) => day.blocks)
  const changed =
    days.length !== numDays ||
    nextDays.some((day, index) => {
      const prev = days[index]
      return !prev || prev.index !== day.index || prev.date !== day.date
    })
  return { days: nextDays, removedBlocks, changed }
}

export function TripSidebar({ onGenerated }: Props) {
  const locale = useSettings((s) => s.locale)
  const llm = useSettings((s) => s.llm)
  const trip = useTripStore((s) => s.trip)
  const setTrip = useTripStore((s) => s.setTrip)
  const [placeResolutions, setPlaceResolutions] = useState<Record<string, PlaceResolution>>({})

  const [meta, setMeta] = useState<TripMeta>(
    () => trip?.meta ?? DEFAULT_META,
  )
  const metaDirtyRef = useRef(false)
  const lastTripIdRef = useRef<string | null>(trip?.id ?? null)

  const updateMeta = (next: TripMeta) => {
    metaDirtyRef.current = true
    setMeta(next)
  }

  // Keep local form in sync if user clears the trip elsewhere.
  useEffect(() => {
    const tripId = trip?.id ?? null
    if (tripId !== lastTripIdRef.current) {
      lastTripIdRef.current = tripId
      metaDirtyRef.current = false
    }
    if (trip?.meta && !metaDirtyRef.current) setMeta(trip.meta)
    else if (!trip) {
      metaDirtyRef.current = false
      setMeta(DEFAULT_META)
    }
  }, [trip?.id, trip?.updatedAt])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Days input is text-driven so the user can clear it mid-edit (e.g. delete
  // "12" → "" → type "5"). We only commit a numeric value when the buffer
  // parses to a positive integer; on blur, an empty / invalid buffer falls
  // back to the last committed numDays.
  const [daysText, setDaysText] = useState<string>(() => String(meta.numDays))
  useEffect(() => {
    setDaysText(String(meta.numDays))
  }, [meta.numDays])

  const destinationContext = useMemo(
    () => meta.countries.map((c) => c.trim()).filter(Boolean).join(', '),
    [meta.countries],
  )
  const mustVisitKey = useMemo(
    () => meta.mustVisit.map((p) => p.trim()).filter(Boolean).join('|'),
    [meta.mustVisit],
  )

  useEffect(() => {
    const places = meta.mustVisit.map((p) => p.trim()).filter(Boolean)
    const wanted = new Set(places)

    setPlaceResolutions((prev) => {
      const next: Record<string, PlaceResolution> = {}
      for (const place of places) {
        const existing = prev[place]
        const queryKey = `${destinationContext}::${place}`
        const stored = storedPlaceResolution(trip, place, queryKey)
        if (existing?.status === 'resolved' && existing.hit) {
          next[place] = existing
        } else if (stored) {
          next[place] = stored
        } else if (existing?.queryKey === queryKey) {
          next[place] = existing
        } else {
          next[place] = { status: 'pending', queryKey, options: [] }
        }
      }
      return sameResolutionMap(prev, next) ? prev : next
    })

    if (places.length === 0) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      ;(async () => {
        for (const place of places) {
          if (controller.signal.aborted) return
          const placeQueryKey = `${destinationContext}::${place}`
          const existing = placeResolutions[place]
          if (
            (existing?.status === 'resolved' && existing.hit) ||
            storedPlaceResolution(trip, place, placeQueryKey)
          ) {
            continue
          }
          try {
            const hits = await geocodeOptions(place, {
              context: destinationContext,
              count: 5,
              signal: controller.signal,
            })
            if (controller.signal.aborted || !wanted.has(place)) return
            if (hits.length > 0) {
              setPlaceResolutions((prev) => ({
                ...prev,
                [place]: {
                  status: 'resolved',
                  queryKey: placeQueryKey,
                  hit: hits[0],
                  options: hits,
                },
              }))
              continue
            }

            const cityOptions = destinationContext
              ? await geocodeOptions(destinationContext, {
                  count: 5,
                  signal: controller.signal,
                })
              : []
            if (controller.signal.aborted || !wanted.has(place)) return
            setPlaceResolutions((prev) => ({
              ...prev,
              [place]: {
                status: 'missing',
                queryKey: placeQueryKey,
                options: cityOptions,
              },
            }))
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return
            setPlaceResolutions((prev) => ({
              ...prev,
              [place]: {
                status: 'missing',
                queryKey: `${destinationContext}::${place}`,
                options: [],
              },
            }))
          }
        }
      })()
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [destinationContext, meta.mustVisit, mustVisitKey, placeResolutions, trip])

  useEffect(() => {
    if (trip && !metaDirtyRef.current && !sameMetaForm(meta, trip.meta)) return
    const mustVisit = meta.mustVisit.map((p) => p.trim()).filter(Boolean)
    const countries = meta.countries.map((p) => p.trim()).filter(Boolean)
    const shouldCreateTrip =
      mustVisit.length > 0 ||
      countries.length > 0 ||
      Boolean(meta.startDate) ||
      meta.numDays !== 4
    if (!trip && !shouldCreateTrip) return

    const baseTrip = trip ?? {
      ...newTrip(),
      meta: { ...meta, countries, mustVisit },
      days: buildBlankDays(meta.numDays, meta.startDate),
    }
    const previousMustVisit = baseTrip.meta.mustVisit.map((p) => p.trim()).filter(Boolean)
    // Track rename of a mustVisit chip by position. Going forward the block's
    // `sourcePlaceKey` is always rekeyed; the title/place.name are only
    // updated when they still match the previous chip text (i.e. the user
    // never customized them).
    const renameMap = new Map<string, { previous: string; next: string }>()
    if (previousMustVisit.length === mustVisit.length) {
      previousMustVisit.forEach((previous, index) => {
        const next = mustVisit[index]
        if (next && !samePlace(previous, next)) {
          renameMap.set(normalizePlace(previous), { previous, next })
        }
      })
    }
    const nextMustVisitKeys = new Set(mustVisit.map(normalizePlace))
    const removedMustVisit = new Set(
      previousMustVisit
        .filter((p) => !nextMustVisitKeys.has(normalizePlace(p)))
        .filter((p) => !renameMap.has(normalizePlace(p)))
        .map(normalizePlace),
    )

    // Set of mustVisit keys that exist after this reconciliation. Used to
    // backfill `sourcePlaceKey` on legacy blocks: if a block predates the
    // field but its current title or place.name still matches a known
    // mustVisit entry, we promote it now so future title edits are safe.
    const currentMustVisitKeys = new Set(mustVisit.map(normalizePlace))
    const resolutionKeys = new Set(
      Object.keys(placeResolutions).map(normalizePlace),
    )

    // Track which sourcePlaceKeys are already claimed by some block, so the
    // backfill pass below doesn't assign the same key to two blocks (which
    // would create a hidden collision).
    const claimedKeys = new Set<string>()
    const allExistingBlocks: Block[] = [
      ...baseTrip.days.flatMap((d) => d.blocks),
      ...baseTrip.unscheduled,
    ]
    for (const b of allExistingBlocks) {
      if (b.sourcePlaceKey) claimedKeys.add(b.sourcePlaceKey)
    }

    // We match a block to its originating mustVisit entry by
    // `sourcePlaceKey`. Blocks created before this field existed (or added
    // manually) fall back to title- and place.name-matching so legacy data
    // and brand-new hand-typed candidates still behave sanely.
    const matchesKey = (block: Block, key: string) =>
      (block.sourcePlaceKey ?? normalizePlace(block.title)) === key

    const remapBlock = (block: Block): { block: Block; changed: boolean; remove: boolean } => {
      let next = block
      let blockChanged = false

      // Backfill sourcePlaceKey for legacy / map-added blocks whose title or
      // place.name still matches a known mustVisit entry, but only if that
      // key isn't already claimed by another block. This is a one-shot
      // upgrade per block.
      if (!next.sourcePlaceKey) {
        const titleKey = normalizePlace(next.title)
        const placeKey = normalizePlace(next.place?.name ?? '')
        const candidates = [titleKey, placeKey].filter(
          (k) => k && currentMustVisitKeys.has(k) && !claimedKeys.has(k),
        )
        const inferred = candidates[0]
        if (inferred) {
          next = { ...next, sourcePlaceKey: inferred }
          claimedKeys.add(inferred)
          blockChanged = true
        }
      }

      const currentKey = next.sourcePlaceKey ?? normalizePlace(next.title)
      if (removedMustVisit.has(currentKey)) {
        return { block: next, changed: true, remove: true }
      }
      const renameEntry = renameMap.get(currentKey)
      if (renameEntry) {
        const renamed = rekeyBlockPlace(next, renameEntry.previous, renameEntry.next)
        if (renamed !== next) {
          next = renamed
          blockChanged = true
        }
      }
      // Look up resolution by sourcePlaceKey (or title for blocks that
      // legitimately have neither, e.g. brand-new manual ones).
      const lookupKey = next.sourcePlaceKey ?? normalizePlace(next.title)
      const resolution = resolutionKeys.has(lookupKey)
        ? placeResolutions[
            Object.keys(placeResolutions).find(
              (name) => normalizePlace(name) === lookupKey,
            )!
          ]
        : undefined
      const resolved = applyPlaceResolution(next, resolution)
      if (resolved !== next) {
        next = resolved
        blockChanged = true
      }
      return { block: next, changed: blockChanged, remove: false }
    }

    let changed = false
    const reconciled = reconcileDays(baseTrip.days, meta.numDays, meta.startDate)
    changed = changed || reconciled.changed || !trip
    const nextDays = reconciled.days.map((day) => ({
      ...day,
      blocks: day.blocks
        .map((block) => remapBlock(block))
        .filter((entry) => {
          if (entry.remove) {
            changed = true
            return false
          }
          if (entry.changed) changed = true
          return true
        })
        .map((entry) => entry.block),
    }))
    const scheduledKeys = new Set(
      nextDays.flatMap((day) =>
        day.blocks.map((block) => block.sourcePlaceKey ?? normalizePlace(block.title)),
      ),
    )
    let nextUnscheduled = [...baseTrip.unscheduled, ...reconciled.removedBlocks]
      .map((block) => remapBlock(block))
      .filter((entry) => {
        if (entry.remove) {
          changed = true
          return false
        }
        if (entry.changed) changed = true
        return true
      })
      .map((entry) => entry.block)

    const knownKeys = new Set([
      ...scheduledKeys,
      ...nextUnscheduled.map((block) => block.sourcePlaceKey ?? normalizePlace(block.title)),
    ])
    for (const place of mustVisit) {
      const key = normalizePlace(place)
      if (knownKeys.has(key)) continue
      // Also skip if any block — even one without a sourcePlaceKey — already
      // represents this place by title or place.name. Prevents duplicates on
      // the first run for legacy data.
      const matchedByLegacyTitle = [...nextDays.flatMap((d) => d.blocks), ...nextUnscheduled].some(
        (block) =>
          !block.sourcePlaceKey &&
          (matchesKey(block, key) ||
            normalizePlace(block.place?.name ?? '') === key),
      )
      if (matchedByLegacyTitle) {
        knownKeys.add(key)
        continue
      }
      nextUnscheduled = [...nextUnscheduled, blockFromPlace(place, placeResolutions[place])]
      knownKeys.add(key)
      changed = true
    }

    const metaChanged =
      metaDirtyRef.current &&
      (baseTrip.meta.mustVisit.join('|') !== mustVisit.join('|') ||
        baseTrip.meta.countries.join('|') !== countries.join('|') ||
        baseTrip.meta.vibes.join('|') !== meta.vibes.join('|') ||
        baseTrip.meta.numDays !== meta.numDays ||
        baseTrip.meta.startDate !== meta.startDate)

    if (changed || metaChanged) {
      setTrip({
        ...baseTrip,
        meta: metaDirtyRef.current
          ? { ...baseTrip.meta, ...meta, countries, mustVisit }
          : baseTrip.meta,
        days: nextDays,
        unscheduled: nextUnscheduled,
      })
      metaDirtyRef.current = false
    }
  }, [meta.countries, meta.mustVisit, meta.numDays, meta.startDate, meta.vibes, placeResolutions, setTrip, trip])

  const MAX_DAYS = 60
  const commitDays = (n: number) => {
    const clamped = Math.max(1, Math.min(MAX_DAYS, Math.floor(n)))
    updateMeta({ ...meta, numDays: clamped })
    setDaysText(String(clamped))
  }
  const commitDaysText = () => {
    const n = Number(daysText)
    if (!daysText || !Number.isFinite(n) || n < 1) {
      setError(locale === 'zh' ? '请输入有效天数' : 'Enter a valid number of days.')
      return null
    }
    const clamped = Math.max(1, Math.min(MAX_DAYS, Math.floor(n)))
    updateMeta({ ...meta, numDays: clamped })
    setDaysText(String(clamped))
    setError(null)
    return clamped
  }

  const endDate = useMemo(() => {
    if (!meta.startDate) return ''
    return addDaysISO(meta.startDate, Math.max(0, meta.numDays - 1))
  }, [meta.startDate, meta.numDays])

  const setEndDate = (iso: string) => {
    if (!meta.startDate) {
      // If only end date is provided first, treat as numDays=1 anchored to it.
      updateMeta({ ...meta, startDate: iso })
      return
    }
    const [sy, sm, sd] = meta.startDate.split('-').map(Number)
    const [ey, em, ed] = iso.split('-').map(Number)
    if (!sy || !ey) return
    const startMs = Date.UTC(sy, sm - 1, sd)
    const endMs = Date.UTC(ey, em - 1, ed)
    const diffDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1)
    updateMeta({ ...meta, numDays: diffDays })
  }

  const guardedReplace = (run: () => void | Promise<void>) => {
    if (
      trip &&
      (trip.days.some((d) => d.blocks.length > 0) || trip.unscheduled.length > 0)
    ) {
      if (!confirm(t(locale, 'confirmRegen'))) return
    }
    return run()
  }

  const submitAI = async () => {
    setError(null)
    const numDays = commitDaysText()
    if (!numDays) return
    const nextMeta = { ...meta, numDays }
    if (!llm.apiKey) {
      setError(t(locale, 'fillKeyFirst'))
      return
    }
    return guardedReplace(async () => {
      setBusy(true)
      try {
        const out = await generateItinerary(nextMeta, llm, locale)
        const t0 = newTrip()
        t0.meta = nextMeta
        t0.days = out.days
        t0.unscheduled = out.candidates
        setTrip(t0)
        onGenerated()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })
  }

  const presets = VIBE_PRESET_KEYS.map((k) => {
    const label = t(locale, k) as unknown as string
    return { value: label, label }
  })

  const choosePlaceOption = (place: string, hit: GeocodeHit) => {
    const nextName = hit.name || place
    const nextMustVisit = meta.mustVisit.map((p) => (p === place ? nextName : p))
    const deduped = Array.from(new Set(nextMustVisit))
    updateMeta({ ...meta, mustVisit: deduped })
    setPlaceResolutions((prev) => {
      const next = { ...prev }
      delete next[place]
      next[nextName] = {
        status: 'resolved',
        queryKey: `${destinationContext}::${nextName}`,
        hit,
        options: [hit],
      }
      return next
    })
  }

  return (
    <aside className="surface-glass relative flex h-fit flex-col gap-5 overflow-hidden p-5">
      <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-brand-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-52 w-52 rounded-full bg-accent-200/30 blur-3xl" />
      <header className="relative flex items-start gap-3">
        <BrandMark label="✦" size="sm" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-900">
            {t(locale, 'sidebarTitle')}
          </h2>
          <p className="mt-0.5 text-caption text-ink-500">{t(locale, 'sidebarHint')}</p>
        </div>
      </header>

      <div className="relative rounded-2xl border border-white/70 bg-white/50 p-4 shadow-sm">
      <FormSection label={t(locale, 'destinations')}>
        <ChipList
          values={meta.countries}
          onChange={(countries) => updateMeta({ ...meta, countries })}
          placeholder={t(locale, 'destinationsPh')}
          addLabel={t(locale, 'addDestination')}
        />
      </FormSection>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <FormSection label={t(locale, 'numDays')}>
        <NumberStepper
          value={daysText}
          unitLabel={locale === 'zh' ? '天' : meta.numDays === 1 ? 'day' : 'days'}
          minReached={meta.numDays <= 1}
          maxReached={meta.numDays >= MAX_DAYS}
          decreaseLabel={locale === 'zh' ? '减少天数' : 'Decrease days'}
          increaseLabel={locale === 'zh' ? '增加天数' : 'Increase days'}
          onDecrease={() => commitDays(meta.numDays - 1)}
          onIncrease={() => commitDays(meta.numDays + 1)}
          onChange={setDaysText}
          onCommit={commitDaysText}
        />
      </FormSection>

      <FormSection label={t(locale, 'dateRange')}>
        {/*
          Native <input type="date"> has an intrinsic min-width driven by its
          "dd/mm/yyyy" placeholder, and flex items default to min-width:auto.
          We use a grid with minmax(0,1fr) tracks so the two inputs can actually
          shrink to fit narrow sidebars.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <input
            type="date"
            className="input min-w-0 px-2"
            value={meta.startDate ?? ''}
            onChange={(e) =>
              updateMeta({ ...meta, startDate: e.target.value || undefined })
            }
          />
          <span className="text-ink-300">→</span>
          <input
            type="date"
            className="input min-w-0 px-2"
            value={endDate}
            onChange={(e) => e.target.value && setEndDate(e.target.value)}
            disabled={!meta.startDate}
          />
        </div>
        <div className="label-hint">
          {locale === 'zh'
            ? '日期可以先不填；只改天数也会立即生成对应天数的框。'
            : 'Dates are optional; changing days immediately updates the board.'}
        </div>
      </FormSection>
      </div>
      </div>

      {trip && <TripMiniMap className="shadow-card" />}

      <div className="relative rounded-2xl border border-white/70 bg-white/50 p-4 shadow-sm">
      <FormSection label={t(locale, 'placesWanted')}>
        <ChipList
          values={meta.mustVisit}
          onChange={(mustVisit) => updateMeta({ ...meta, mustVisit })}
          placeholder={t(locale, 'placesWantedPh')}
          addLabel={t(locale, 'addPlace')}
        />
        {meta.mustVisit.length > 0 && (
          <div className="mt-3 space-y-2">
            {meta.mustVisit.map((place) => {
              const resolution = placeResolutions[place]
              if (!resolution) return null
              const statusLabel =
                resolution.status === 'pending'
                  ? locale === 'zh'
                    ? '正在解析位置…'
                    : 'Resolving location…'
                  : resolution.status === 'resolved'
                    ? locale === 'zh'
                      ? '已定位'
                      : 'Located'
                    : locale === 'zh'
                      ? '未找到精确位置'
                      : 'Exact place not found'
              const statusClass =
                resolution.status === 'pending'
                  ? 'chip-blue'
                  : resolution.status === 'resolved'
                    ? 'chip-green'
                    : 'chip-amber'
              const showOptions =
                resolution.status === 'missing' ||
                (resolution.status === 'resolved' && resolution.options.length > 1)
              return (
                <div key={place} className="rounded-2xl border border-white/70 bg-white/55 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-ink-800">{place}</span>
                    <span className={statusClass}>{statusLabel}</span>
                    {resolution.hit && (
                      <span className="text-caption text-ink-500">
                        {geocodeLabel(resolution.hit)}
                      </span>
                    )}
                  </div>
                  {showOptions && resolution.options.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 text-caption text-ink-400">
                        {resolution.status === 'missing'
                          ? locale === 'zh'
                            ? '可尝试选择这些城市内匹配项：'
                            : 'Try one of these city matches:'
                          : locale === 'zh'
                            ? '其它可能匹配：'
                            : 'Other possible matches:'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {resolution.options.slice(0, 4).map((hit) => (
                          <button
                            key={`${hit.name}-${hit.lat}-${hit.lng}`}
                            type="button"
                            className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-caption font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-white"
                            onClick={() => choosePlaceOption(place, hit)}
                          >
                            {hit.name}
                            {geocodeLabel(hit) ? ` · ${geocodeLabel(hit)}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {resolution.status === 'missing' && resolution.options.length === 0 && (
                    <div className="mt-1 text-caption text-ink-400">
                      {locale === 'zh'
                        ? '没有找到候选位置，可以尝试加上区名、英文名或更具体的城市。'
                        : 'No suggestions found. Try adding a district, English name, or a more specific city.'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </FormSection>

      <div className="mt-5">
      <FormSection label={t(locale, 'preferences')}>
        <ChipList
          values={meta.vibes}
          onChange={(vibes) => updateMeta({ ...meta, vibes })}
          placeholder={t(locale, 'preferences')}
          addLabel={t(locale, 'addPreference')}
          presets={presets}
        />
      </FormSection>
      </div>
      </div>

      {error && (
        <ErrorState message={error} className="text-xs" />
      )}

      {busy && (
        <LoadingState
          title={t(locale, 'generating')}
          description={t(locale, 'sidebarHint')}
          className="bg-white/70"
        />
      )}

      <div className="space-y-2">
        <Button variant="gradient" className="w-full" onClick={submitAI} disabled={busy}>
          {busy ? t(locale, 'generating') : t(locale, 'generate')}
        </Button>
      </div>
    </aside>
  )
}
