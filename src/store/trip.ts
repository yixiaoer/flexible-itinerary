import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, Day, Daypart, Evidence, Trip, TripMeta, TripStatus } from '../types'
import { UNSCHEDULED_ID } from '../types'
import { uid } from '../lib/id'
import { addDaysISO, blockDaypart, DAYPART_DEFAULT_RANGE, fmtHHMM, parseHHMM, type TimedDaypart } from '../lib/time'

interface TripState {
  trip: Trip | null
  library: Trip[]
  setTrip: (trip: Trip | null) => void
  createBlankTrip: () => void
  clearArrangements: () => void
  reorderLibraryTrip: (activeId: string, overId: string) => void
  saveTripToLibrary: (trip?: Trip | null) => void
  syncTripToLibrary: (trip?: Trip | null) => void
  loadLibraryTrip: (tripId: string) => void
  deleteLibraryTrip: (tripId: string) => void
  duplicateLibraryTrip: (tripId: string) => void
  importLibraryTrip: (trip: Trip) => void
  setLibraryTripStatus: (tripId: string, status: TripStatus) => void
  patchMeta: (patch: Partial<TripMeta>) => void

  addDay: () => void
  removeDay: (dayId: string) => void
  clearDayArrangements: (dayId: string) => void
  patchDay: (dayId: string, patch: Partial<Day>) => void

  /** dayId can be UNSCHEDULED_ID to add to the candidates pool. */
  addBlock: (dayId: string, block: Block) => void
  patchBlock: (dayId: string, blockId: string, patch: Partial<Block>) => void
  removeBlock: (dayId: string, blockId: string) => void
  toggleLock: (dayId: string, blockId: string) => void
  setDaypartBoundary: (dayId: string, blockId: string, daypart: Daypart) => void
  setEvidence: (dayId: string, blockId: string, evidence: Evidence) => void

  /** Replace blocks of one day (used by AI replan). Locked blocks are preserved. */
  replaceDayBlocks: (dayId: string, blocks: Block[]) => void
  /** Replace days entirely (used by AI full-trip replan). */
  replaceDays: (days: Day[]) => void

  /** Append blocks to the candidates pool (used by AI suggestion flow). */
  appendUnscheduled: (blocks: Block[]) => void
  /** Replace the entire candidates pool. */
  setUnscheduled: (blocks: Block[]) => void

  /**
   * Move a block between containers. fromDay / toDay can be either a Day.id
   * or UNSCHEDULED_ID for the candidates pool.
   */
  moveBlock: (
    fromDay: string,
    blockId: string,
    toDay: string,
    toIndex: number,
  ) => void

  reset: () => void
}

function newTrip(): Trip {
  return {
    id: uid('trip'),
    meta: {
      title: '',
      countries: [],
      mustVisit: [],
      vibes: [],
      // A brand-new trip starts with no days; the board stays empty until
      // the user explicitly bumps the day count or adds a day from the top
      // toolbar.
      numDays: 0,
      travelers: 1,
    },
    days: [],
    unscheduled: [],
    updatedAt: new Date().toISOString(),
  }
}

function bumpUpdated(trip: Trip): Trip {
  return { ...trip, updatedAt: new Date().toISOString() }
}

function cloneTrip(trip: Trip): Trip {
  return JSON.parse(JSON.stringify(trip)) as Trip
}

function normalizeTrip(trip: Trip, preserveId = true): Trip {
  return {
    ...cloneTrip(trip),
    id: preserveId && trip.id ? trip.id : uid('trip'),
    meta: {
      title: trip.meta?.title ?? '',
      countries: trip.meta?.countries ?? [],
      mustVisit: trip.meta?.mustVisit ?? [],
      vibes: trip.meta?.vibes ?? [],
      numDays: trip.meta?.numDays ?? trip.days?.length ?? 1,
      startDate: trip.meta?.startDate,
      origin: trip.meta?.origin,
      travelers: trip.meta?.travelers ?? 1,
      statusOverride: trip.meta?.statusOverride,
    },
    days: trip.days ?? [],
    unscheduled: trip.unscheduled ?? [],
    updatedAt: trip.updatedAt ?? new Date().toISOString(),
  }
}

function upsertLibrary(library: Trip[], trip?: Trip | null): Trip[] {
  if (!trip) return library
  const saved = cloneTrip(trip)
  const existingIndex = library.findIndex((item) => item.id === saved.id)
  const existing = existingIndex >= 0 ? library[existingIndex] : undefined
  if (existing?.updatedAt === saved.updatedAt) return library
  if (existingIndex >= 0) {
    const next = [...library]
    next[existingIndex] = saved
    return next
  }
  return [saved, ...library]
}

function snapshotTrip(trip: Trip): Trip {
  const now = new Date().toISOString()
  return normalizeTrip({
    ...trip,
    id: uid('trip'),
    updatedAt: now,
  }, true)
}

export function buildBlankDays(numDays: number, startDate?: string): Day[] {
  const days: Day[] = []
  for (let i = 0; i < numDays; i++) {
    days.push({
      id: uid('day'),
      index: i + 1,
      date: startDate ? addDaysISO(startDate, i) : undefined,
      blocks: [],
    })
  }
  return days
}

// =============================================================================
// Block-container helpers used by per-block mutations. We treat the trip as a
// list of "containers", each with an id and a blocks array. Day.id for days,
// UNSCHEDULED_ID for the candidates pool.
// =============================================================================

function findContainerBlocks(trip: Trip, containerId: string): Block[] | null {
  if (containerId === UNSCHEDULED_ID) return trip.unscheduled
  return trip.days.find((d) => d.id === containerId)?.blocks ?? null
}

function withContainerBlocks(
  trip: Trip,
  containerId: string,
  next: Block[],
): Trip {
  if (containerId === UNSCHEDULED_ID) {
    return { ...trip, unscheduled: next }
  }
  return {
    ...trip,
    days: trip.days.map((d) =>
      d.id === containerId ? { ...d, blocks: next } : d,
    ),
  }
}

function blockStartMin(block: Block): number | undefined {
  const explicit = parseHHMM(block.startTime)
  if (explicit !== undefined) return explicit
  const daypart = blockDaypart(block)
  if (daypart === 'ANY') return undefined
  return parseHHMM(DAYPART_DEFAULT_RANGE[daypart][0])
}

function blockEndMin(block: Block): number | undefined {
  const explicit = parseHHMM(block.endTime)
  if (explicit !== undefined) return explicit
  const start = blockStartMin(block)
  return start === undefined ? undefined : start + effectiveDurationMin(block)
}

function effectiveDurationMin(block: Block): number {
  return Math.max(5, block.durationMin ?? 90)
}

function isTimedDaypart(daypart?: Daypart): daypart is TimedDaypart {
  return daypart === 'AM' || daypart === 'PM' || daypart === 'EVE'
}

function anchorDaypart(block?: Block): TimedDaypart | undefined {
  const daypart = block ? blockDaypart(block) : undefined
  return isTimedDaypart(daypart) ? daypart : undefined
}

function inferAnchorDaypart(prev?: Block, next?: Block, fallback?: Daypart): TimedDaypart {
  const prevDaypart = anchorDaypart(prev)
  if (prevDaypart) return prevDaypart
  const nextDaypart = anchorDaypart(next)
  if (nextDaypart) return nextDaypart
  if (isTimedDaypart(fallback)) return fallback
  return 'AM'
}

function moveBlockToDaypart(block: Block, daypart: Daypart): Block {
  if (block.locked) return block
  if (daypart === 'ANY') {
    return { ...block, daypart: 'ANY', startTime: undefined, endTime: undefined }
  }
  if (block.granularity === 'flexible') {
    return { ...block, daypart, startTime: undefined, endTime: undefined }
  }
  const duration = effectiveDurationMin(block)
  const start = parseHHMM(DAYPART_DEFAULT_RANGE[daypart][0]) ?? 9 * 60
  return {
    ...block,
    daypart: undefined,
    startTime: fmtHHMM(start),
    endTime: fmtHHMM(start + duration),
  }
}

function retimeBlocksInOrder(blocks: Block[]): Block[] {
  const cursor: Record<TimedDaypart, number> = {
    AM: parseHHMM(DAYPART_DEFAULT_RANGE.AM[0]) ?? 9 * 60,
    PM: parseHHMM(DAYPART_DEFAULT_RANGE.PM[0]) ?? 13 * 60,
    EVE: parseHHMM(DAYPART_DEFAULT_RANGE.EVE[0]) ?? 18 * 60 + 30,
  }

  return blocks.map((block) => {
    const daypart = blockDaypart(block)
    if (daypart === 'ANY') return { ...block, daypart: 'ANY', startTime: undefined, endTime: undefined }
    const duration = effectiveDurationMin(block)

    if (block.locked) {
      const end = blockEndMin(block)
      if (end !== undefined) cursor[daypart] = Math.max(cursor[daypart], end)
      return block
    }

    if (block.granularity === 'flexible') {
      cursor[daypart] += duration
      return { ...block, daypart, startTime: undefined, endTime: undefined }
    }

    const rangeStart = parseHHMM(DAYPART_DEFAULT_RANGE[daypart][0]) ?? cursor[daypart]
    const start = Math.max(cursor[daypart], rangeStart)
    cursor[daypart] = start + duration
    return {
      ...block,
      daypart: undefined,
      startTime: fmtHHMM(start),
      endTime: fmtHHMM(start + duration),
    }
  })
}

function normalizeDaypartOrder(blocks: Block[], initialPhase: TimedDaypart = 'AM'): Block[] {
  let phase: TimedDaypart = initialPhase
  const normalized = blocks.map((block) => {
    const current = blockDaypart(block)
    if (current === 'ANY') return block
    if (current === 'EVE') phase = 'EVE'
    else if (current === 'PM' && phase === 'AM') phase = 'PM'
    return moveBlockToDaypart(block, phase)
  })
  return retimeBlocksInOrder(normalized)
}

function forceSegmentToDaypart(blocks: Block[], daypart: Daypart): Block[] {
  return blocks.map((block) =>
    blockDaypart(block) === 'ANY' ? block : moveBlockToDaypart(block, daypart),
  )
}

function applyDaypartBoundary(blocks: Block[], blockId: string, target: Daypart): Block[] {
  const boundary = blocks.findIndex((b) => b.id === blockId)
  if (boundary < 0) return blocks
  const withTarget = blocks.map((block, index) =>
    index === boundary ? moveBlockToDaypart(block, target) : block,
  )

  if (target === 'ANY') return retimeBlocksInOrder(withTarget)
  if (target === 'EVE') {
    return retimeBlocksInOrder([
      ...normalizeDaypartOrder(withTarget.slice(0, boundary)),
      ...forceSegmentToDaypart(withTarget.slice(boundary), 'EVE'),
    ])
  }
  if (target === 'PM') {
    return retimeBlocksInOrder([
      ...forceSegmentToDaypart(withTarget.slice(0, boundary), 'AM'),
      ...normalizeDaypartOrder(withTarget.slice(boundary), 'PM'),
    ])
  }
  return retimeBlocksInOrder([
    ...forceSegmentToDaypart(withTarget.slice(0, boundary + 1), 'AM'),
    ...normalizeDaypartOrder(withTarget.slice(boundary + 1), 'PM'),
  ])
}

function inferStartMinute(block: Block, prev: Block | undefined, next: Block | undefined, daypart: TimedDaypart): number {
  const duration = effectiveDurationMin(block)
  const defaultStart = parseHHMM(DAYPART_DEFAULT_RANGE[daypart][0]) ?? 9 * 60
  const defaultEnd = parseHHMM(DAYPART_DEFAULT_RANGE[daypart][1]) ?? defaultStart + duration
  const prevEnd = prev ? blockEndMin(prev) : undefined
  const nextStart = next ? blockStartMin(next) : undefined

  if (prevEnd !== undefined && nextStart !== undefined) {
    if (prevEnd + duration <= nextStart) return Math.max(defaultStart, prevEnd)
    return Math.max(defaultStart, nextStart - duration)
  }
  if (prevEnd !== undefined) return Math.max(defaultStart, prevEnd)
  if (nextStart !== undefined) return Math.max(defaultStart, nextStart - duration)
  return Math.min(defaultStart, Math.max(defaultStart, defaultEnd - duration))
}

function retimeMovedBlock(block: Block, targetBlocks: Block[], insertAt: number): Block {
  if (block.locked) return block

  const prev = targetBlocks[insertAt - 1]
  const next = targetBlocks[insertAt]
  const inferredDaypart = inferAnchorDaypart(prev, next, block.daypart)

  if (block.granularity === 'flexible') {
    if (block.daypart === 'ANY') {
      return { ...block, daypart: 'ANY', startTime: undefined, endTime: undefined }
    }
    return {
      ...block,
      daypart: inferredDaypart,
      startTime: undefined,
      endTime: undefined,
    }
  }

  const start = inferStartMinute(block, prev, next, inferredDaypart)
  const duration = effectiveDurationMin(block)
  return {
    ...block,
    daypart: undefined,
    startTime: fmtHHMM(start),
    endTime: fmtHHMM(start + duration),
  }
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => {
      const commitTrip = (trip: Trip | null) => {
        set((state) => ({
          trip,
          library: trip ? upsertLibrary(state.library, trip) : state.library,
        }))
      }

      const commitUpdatedTrip = (trip: Trip) => {
        commitTrip(bumpUpdated(trip))
      }

      return {
        trip: null,
        library: [],

        setTrip: (trip) => {
          commitTrip(
            trip
              ? bumpUpdated({ ...trip, unscheduled: trip.unscheduled ?? [] })
              : null,
          )
        },

        createBlankTrip: () => {
          const trip = newTrip()
          trip.days = buildBlankDays(trip.meta.numDays, trip.meta.startDate)
          commitTrip(trip)
        },

        clearArrangements: () => {
          const t = get().trip
          if (!t) return
          const nextMeta: TripMeta = {
            title: '',
            countries: t.meta.countries,
            mustVisit: [],
            vibes: [],
            // Match `newTrip` — clearing should produce an empty board, not
            // a pre-populated 4-day skeleton.
            numDays: 0,
            travelers: t.meta.travelers ?? 1,
          }
          commitUpdatedTrip({
            ...t,
            meta: nextMeta,
            days: buildBlankDays(nextMeta.numDays),
            unscheduled: [],
          })
        },

        reorderLibraryTrip: (activeId, overId) => {
          if (activeId === overId) return
          set((state) => {
            const from = state.library.findIndex((item) => item.id === activeId)
            const to = state.library.findIndex((item) => item.id === overId)
            if (from < 0 || to < 0) return state
            const next = [...state.library]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return { library: next }
          })
        },

      saveTripToLibrary: (trip) => {
        const target = trip === undefined ? get().trip : trip
        if (!target) return
        const snapshot = snapshotTrip(target)
        set((state) => ({ library: upsertLibrary(state.library, snapshot) }))
      },

      syncTripToLibrary: (trip) => {
        const target = trip === undefined ? get().trip : trip
        if (!target) return
        set((state) => ({ library: upsertLibrary(state.library, target) }))
      },

      loadLibraryTrip: (tripId) => {
        const found = get().library.find((item) => item.id === tripId)
        if (!found) return
        commitTrip(cloneTrip(found))
      },

      deleteLibraryTrip: (tripId) => {
        set((state) => ({
          library: state.library.filter((item) => item.id !== tripId),
          trip: state.trip?.id === tripId ? null : state.trip,
        }))
      },

      duplicateLibraryTrip: (tripId) => {
        const found = get().library.find((item) => item.id === tripId)
        if (!found) return
        const now = new Date().toISOString()
        const copy = normalizeTrip({
          ...found,
          id: uid('trip'),
          meta: {
            ...found.meta,
            title: found.meta.title
              ? `${found.meta.title} copy`
              : found.meta.countries.length > 0
                ? `${found.meta.countries.join(', ')} copy`
                : 'Trip copy',
          },
          updatedAt: now,
        }, true)
        commitTrip(copy)
      },

      importLibraryTrip: (trip) => {
        const existingIds = new Set(get().library.map((item) => item.id))
        const normalized = normalizeTrip(
          {
            ...trip,
            id: existingIds.has(trip.id) ? uid('trip') : trip.id,
            updatedAt: new Date().toISOString(),
          },
          true,
        )
        commitTrip(normalized)
      },

      setLibraryTripStatus: (tripId, status) => {
        const now = new Date().toISOString()
        set((state) => {
          const nextLibrary = state.library.map((item) =>
            item.id === tripId
              ? bumpUpdated({
                  ...item,
                  meta: { ...item.meta, statusOverride: status },
                  updatedAt: now,
                })
              : item,
          )
          const nextTrip =
            state.trip?.id === tripId
              ? bumpUpdated({
                  ...state.trip,
                  meta: { ...state.trip.meta, statusOverride: status },
                  updatedAt: now,
                })
              : state.trip
          return {
            trip: nextTrip,
            library: nextLibrary,
          }
        })
      },

      patchMeta: (patch) => {
        const t = get().trip
        if (!t) return
        commitUpdatedTrip({ ...t, meta: { ...t.meta, ...patch } })
      },

      addDay: () => {
        const t = get().trip
        if (!t) return
        const last = t.days[t.days.length - 1]
        const nextIndex = (last?.index ?? 0) + 1
        const nextDate = last?.date ? addDaysISO(last.date, 1) : undefined
        const day: Day = {
          id: uid('day'),
          index: nextIndex,
          date: nextDate,
          blocks: [],
        }
        commitUpdatedTrip({
            ...t,
            days: [...t.days, day],
            meta: { ...t.meta, numDays: t.days.length + 1 },
        })
      },

      removeDay: (dayId) => {
        const t = get().trip
        if (!t) return
        const removed = t.days.find((d) => d.id === dayId)
        const days = t.days
          .filter((d) => d.id !== dayId)
          .map((d, i) => ({ ...d, index: i + 1 }))
        // Move that day's blocks into the candidates pool so user doesn't lose them.
        const unscheduled = removed
          ? [...t.unscheduled, ...removed.blocks]
          : t.unscheduled
        commitUpdatedTrip({
            ...t,
            days,
            unscheduled,
            meta: { ...t.meta, numDays: days.length },
        })
      },

      clearDayArrangements: (dayId) => {
        const t = get().trip
        if (!t) return
        const target = t.days.find((d) => d.id === dayId)
        if (!target || target.blocks.length === 0) return
        commitUpdatedTrip({
          ...t,
          days: t.days.map((day) =>
            day.id === dayId ? { ...day, blocks: [] } : day,
          ),
          unscheduled: [...t.unscheduled, ...target.blocks],
        })
      },

      patchDay: (dayId, patch) => {
        const t = get().trip
        if (!t) return
        commitUpdatedTrip({
            ...t,
            days: t.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
        })
      },

      addBlock: (containerId, block) => {
        const t = get().trip
        if (!t) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        commitUpdatedTrip(withContainerBlocks(t, containerId, [...blocks, block]))
      },

      patchBlock: (containerId, blockId, patch) => {
        const t = get().trip
        if (!t) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        const next = blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
        commitUpdatedTrip(withContainerBlocks(t, containerId, next))
      },

      removeBlock: (containerId, blockId) => {
        const t = get().trip
        if (!t) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        const next = blocks.filter((b) => b.id !== blockId)
        commitUpdatedTrip(withContainerBlocks(t, containerId, next))
      },

      toggleLock: (containerId, blockId) => {
        const t = get().trip
        if (!t) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        const next = blocks.map((b) =>
          b.id === blockId ? { ...b, locked: !b.locked } : b,
        )
        commitUpdatedTrip(withContainerBlocks(t, containerId, next))
      },

      setDaypartBoundary: (containerId, blockId, daypart) => {
        const t = get().trip
        if (!t || containerId === UNSCHEDULED_ID) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        commitUpdatedTrip(withContainerBlocks(t, containerId, applyDaypartBoundary(blocks, blockId, daypart)))
      },

      setEvidence: (containerId, blockId, evidence) => {
        const t = get().trip
        if (!t) return
        const blocks = findContainerBlocks(t, containerId)
        if (!blocks) return
        const next = blocks.map((b) =>
          b.id === blockId ? { ...b, evidence } : b,
        )
        commitUpdatedTrip(withContainerBlocks(t, containerId, next))
      },

      replaceDayBlocks: (dayId, blocks) => {
        const t = get().trip
        if (!t) return
        commitUpdatedTrip({
            ...t,
            days: t.days.map((d) =>
              d.id === dayId ? { ...d, blocks } : d,
            ),
        })
      },

      replaceDays: (days) => {
        const t = get().trip
        if (!t) return
        commitUpdatedTrip({ ...t, days })
      },

      appendUnscheduled: (blocks) => {
        const t = get().trip
        if (!t) return
        if (blocks.length === 0) return
        // Dedup by title to avoid the same suggestion piling up.
        const have = new Set(t.unscheduled.map((b) => b.title.trim().toLowerCase()))
        const dayTitles = new Set(
          t.days.flatMap((d) => d.blocks).map((b) => b.title.trim().toLowerCase()),
        )
        const fresh = blocks.filter((b) => {
          const k = b.title.trim().toLowerCase()
          if (!k) return false
          if (have.has(k)) return false
          if (dayTitles.has(k)) return false
          have.add(k)
          return true
        })
        if (fresh.length === 0) return
        commitUpdatedTrip({ ...t, unscheduled: [...t.unscheduled, ...fresh] })
      },

      setUnscheduled: (unscheduled) => {
        const t = get().trip
        if (!t) return
        commitUpdatedTrip({ ...t, unscheduled })
      },

      moveBlock: (fromDay, blockId, toDay, toIndex) => {
        const t = get().trip
        if (!t) return
        const fromBlocks = findContainerBlocks(t, fromDay)
        if (!fromBlocks) return
        const block = fromBlocks.find((b) => b.id === blockId)
        if (!block) return

        if (fromDay === toDay) {
          const without = fromBlocks.filter((b) => b.id !== blockId)
          const insertAt = Math.max(0, Math.min(toIndex, without.length))
          const next = [...without]
          next.splice(
            insertAt,
            0,
            fromDay === UNSCHEDULED_ID ? block : retimeMovedBlock(block, without, insertAt),
          )
          commitUpdatedTrip(
            withContainerBlocks(
              t,
              fromDay,
              fromDay === UNSCHEDULED_ID ? next : normalizeDaypartOrder(next),
            ),
          )
          return
        }

        // Different containers — remove from source first, then insert into target.
        const t1 = withContainerBlocks(
          t,
          fromDay,
          fromDay === UNSCHEDULED_ID
            ? fromBlocks.filter((b) => b.id !== blockId)
            : normalizeDaypartOrder(fromBlocks.filter((b) => b.id !== blockId)),
        )
        const targetBlocks = findContainerBlocks(t1, toDay)
        if (!targetBlocks) return
        const insertAt = Math.max(0, Math.min(toIndex, targetBlocks.length))
        const nextTarget = [...targetBlocks]
        nextTarget.splice(
          insertAt,
          0,
          toDay === UNSCHEDULED_ID ? block : retimeMovedBlock(block, targetBlocks, insertAt),
        )
        commitUpdatedTrip(
          withContainerBlocks(
            t1,
            toDay,
            toDay === UNSCHEDULED_ID ? nextTarget : normalizeDaypartOrder(nextTarget),
          ),
        )
      },

      reset: () => set({ trip: null }),
      }
    },
    {
      name: 'fi.trip.v2',
      version: 6,
      partialize: (state) => ({
        trip: state.trip,
        library: state.library,
      }),
      migrate: (persisted: unknown, version: number) => {
        // Best-effort migration from older versions. Versions before 5 may
        // contain stale active workspace data, so they are backed up into the
        // library but not restored as the live draft. From version 5 onward the
        // active workspace is trusted and also appears as a library trip file.
        const p = persisted as { trip?: Partial<Trip> & { meta?: { vibe?: string } }; library?: Trip[] } | undefined
        if (!p?.trip) {
          return {
            trip: null,
            library: Array.isArray(p?.library) ? p.library.map((item) => normalizeTrip(item)) : [],
          } as TripState
        }
        const trip = p.trip
        const migrated: Trip = {
          id: trip.id ?? uid('trip'),
          meta: {
            title: trip.meta?.title ?? '',
            countries: trip.meta?.countries ?? [],
            mustVisit: trip.meta?.mustVisit ?? [],
            vibes:
              trip.meta?.vibes ??
              (typeof trip.meta?.vibe === 'string' && trip.meta.vibe
                ? [trip.meta.vibe]
                : []),
            numDays: trip.meta?.numDays ?? trip.days?.length ?? 3,
            startDate: trip.meta?.startDate,
            origin: trip.meta?.origin,
            travelers: trip.meta?.travelers ?? 1,
            statusOverride: trip.meta?.statusOverride,
          },
          days: trip.days ?? [],
          unscheduled: trip.unscheduled ?? [],
          updatedAt: trip.updatedAt ?? new Date().toISOString(),
        }
        const library = Array.isArray(p.library) ? p.library.map((item) => normalizeTrip(item)) : []
        if (typeof version !== 'number' || version < 5) {
          return { trip: null, library: upsertLibrary(library, migrated) } as TripState
        }
        return { trip: migrated, library: upsertLibrary(library, migrated) } as TripState
      },
    },
  ),
)

export { newTrip }
