// High-level orchestrators that wire LLM, prompts, geocoding and weather.

import type { Block, Day, Locale, Trip, TripMeta } from '../types'
import type { LLMSettings } from '../types'
import { chat, extractJSON, LLMError } from './llm'
import {
  coerceBlock,
  coerceDays,
  generatePrompt,
  replanPrompt,
  suggestCandidatesPrompt,
  systemPrompt,
  validatePrompt,
  type RawBlock,
  type RawDay,
  type RawTripPayload,
  type ValidateInputBlock,
} from './prompts'
import { fetchDailyForecast, geocode } from './weather'
import { uid } from './id'

export interface GenerateOutcome {
  days: Day[]
  /** "Nice-to-have" suggestions to seed the candidates pool. */
  candidates: Block[]
}

export async function generateItinerary(
  meta: TripMeta,
  llm: LLMSettings,
  locale: Locale,
): Promise<GenerateOutcome> {
  const sys = systemPrompt(locale, llm.extraSystem)
  const usr = generatePrompt(meta, locale)
  const text = await chat(
    llm,
    [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    { jsonMode: true },
  )
  const raw = extractJSON<RawTripPayload>(text)
  if (!raw) {
    throw new LLMError(`Could not parse JSON from LLM. Raw:\n${text.slice(0, 800)}`)
  }
  const days = coerceDays(raw, meta.numDays, meta.startDate)
  const candidates = (raw.candidates ?? []).map(coerceBlock)
  return { days, candidates }
}

/**
 * Pure-manual seed: build a Trip skeleton from the user's input without calling
 * any LLM. Empty days, with all `mustVisit` places dropped into the candidates
 * pool as flexible blocks the user can drag into days at will.
 */
export function seedManualTrip(meta: TripMeta): Trip {
  const days: Day[] = []
  for (let i = 0; i < meta.numDays; i++) {
    days.push({
      id: uid('day'),
      index: i + 1,
      date: meta.startDate
        ? offsetDateLocal(meta.startDate, i)
        : undefined,
      blocks: [],
    })
  }
  const unscheduled: Block[] = meta.mustVisit.map((name) => ({
    id: uid('blk'),
    kind: 'sightseeing',
    title: name,
    place: { name },
    granularity: 'flexible',
    daypart: 'ANY',
    locked: false,
  }))
  return {
    id: uid('trip'),
    meta,
    days,
    unscheduled,
    updatedAt: new Date().toISOString(),
  }
}

function offsetDateLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/**
 * Ask the LLM to suggest additional places worth considering, given the
 * current trip. Returned blocks are intended for the candidates pool — they
 * are NOT auto-assigned to days.
 */
export async function suggestCandidates(
  trip: Trip,
  llm: LLMSettings,
  locale: Locale,
): Promise<Block[]> {
  const sys = systemPrompt(locale, llm.extraSystem)
  const usr = suggestCandidatesPrompt(trip, locale)
  const text = await chat(
    llm,
    [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    { jsonMode: true },
  )
  const json = extractJSON<{ candidates?: RawBlock[] }>(text)
  return (json?.candidates ?? []).map(coerceBlock)
}

export interface ReplanArgs {
  trip: Trip
  situation: string
  /** If provided, replans only that day; otherwise full trip. */
  focusDayId?: string
}

export interface ReplanResult {
  /** Updated days (full trip) — caller decides how to merge. */
  days: Day[]
}

export async function replanTrip(
  args: ReplanArgs,
  llm: LLMSettings,
  locale: Locale,
): Promise<ReplanResult> {
  const sys = systemPrompt(locale, llm.extraSystem)
  const usr = replanPrompt(args, locale)
  const text = await chat(
    llm,
    [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    { jsonMode: true },
  )
  const raw = extractJSON<RawTripPayload>(text)
  if (!raw) {
    throw new LLMError(`Could not parse JSON from LLM. Raw:\n${text.slice(0, 800)}`)
  }
  const newDaysList = Array.isArray(raw.days) ? raw.days : []

  if (args.focusDayId) {
    const day = args.trip.days.find((d) => d.id === args.focusDayId)
    if (!day) return { days: args.trip.days }
    // Find returned day matching index, else assume the only day returned.
    const returned: RawDay | undefined =
      newDaysList.find((d) => d?.index === day.index) ?? newDaysList[0]
    const newBlocks = (returned?.blocks ?? []).map(coerceBlock)
    const merged = mergeWithLocked(day.blocks, newBlocks)
    const days = args.trip.days.map((d) =>
      d.id === args.focusDayId ? { ...d, blocks: merged, note: returned?.note ?? d.note } : d,
    )
    return { days }
  }

  // Full-trip replan: align by index.
  const days = args.trip.days.map((d, i) => {
    const returned: RawDay | undefined =
      newDaysList.find((x) => x?.index === d.index) ?? newDaysList[i]
    if (!returned) return d
    const newBlocks = (returned.blocks ?? []).map(coerceBlock)
    const merged = mergeWithLocked(d.blocks, newBlocks)
    return { ...d, blocks: merged, note: returned.note ?? d.note }
  })
  return { days }
}

/**
 * After AI replan we forcibly re-insert any locked blocks from the original
 * day, in case the model dropped or modified them.
 */
function mergeWithLocked(originalBlocks: Block[], newBlocks: Block[]): Block[] {
  const lockedOriginals = originalBlocks.filter((b) => b.locked)
  const lockedIds = new Set(lockedOriginals.map((b) => b.id))

  const filtered = newBlocks
    .filter((b) => !lockedIds.has(b.id))
    .map((b) => ({ ...b, locked: false })) // safety: model can't lock

  const combined = [...filtered, ...lockedOriginals.map((b) => ({ ...b }))]

  // Sort: precise by start time, rough by daypart, locked precise still wins.
  return combined.sort((a, b) => sortKey(a) - sortKey(b))
}

function sortKey(b: Block): number {
  if ((b.granularity === 'precise' || b.granularity === 'window') && b.startTime) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(b.startTime)
    if (m) return Number(m[1]) * 60 + Number(m[2])
  }
  if (b.daypart === 'AM') return 9 * 60
  if (b.daypart === 'ANY') return 10 * 60
  if (b.daypart === 'PM') return 13 * 60
  if (b.daypart === 'EVE') return 18 * 60 + 30
  return 9 * 60
}

// =============================================================================
// Evidence layer
// =============================================================================

export interface ValidateOutcome {
  /** Map from blockId to evidence-fragment fields. */
  byBlockId: Record<
    string,
    {
      weatherSummary?: string
      weatherFit?: number
      closedOnDate?: boolean
      notes?: string[]
    }
  >
}

/**
 * Runs a 3-step pipeline:
 *  1. For each Day, geocode the first block with a place name to get lat/lng.
 *  2. Fetch Open-Meteo daily forecast for that location across the trip dates.
 *  3. Ask LLM to assess each block against (a) the real weather summary and
 *     (b) its own knowledge of typical opening hours.
 */
export async function validateTrip(
  trip: Trip,
  llm: LLMSettings,
  locale: Locale,
  signal?: AbortSignal,
): Promise<ValidateOutcome> {
  const out: ValidateOutcome = { byBlockId: {} }

  // Step 1+2: fetch weather per day (best-effort; skip if no date or no place).
  const weatherByDay = new Map<string, string>() // dayId -> summary

  for (const d of trip.days) {
    if (!d.date) continue
    const sample = d.blocks.find((b) => b.place?.name)
    if (!sample?.place?.name) continue
    try {
      const hint = sample.place.address
        ? `${sample.place.name}, ${sample.place.address}`
        : sample.place.name
      const hit = await geocode(hint, signal)
      if (!hit) continue
      const forecast = await fetchDailyForecast(hit.lat, hit.lng, d.date, d.date, locale, signal)
      if (forecast[0]) weatherByDay.set(d.id, forecast[0].summary)
    } catch {
      // ignore network failures — evidence layer is best-effort
    }
  }

  // Step 3: LLM assessment.
  const items: ValidateInputBlock[] = []
  for (const d of trip.days) {
    const w = weatherByDay.get(d.id)
    for (const b of d.blocks) {
      items.push({
        blockId: b.id,
        dayIndex: d.index,
        date: d.date,
        title: b.title,
        place: [b.place?.name, b.place?.address].filter(Boolean).join(', '),
        indoor: b.place?.indoor,
        weather: w,
      })
    }
    if (w) {
      // attach weather to all blocks of this day in pre-fill (LLM may refine)
      for (const b of d.blocks) {
        out.byBlockId[b.id] = { ...(out.byBlockId[b.id] ?? {}), weatherSummary: w }
      }
    }
  }

  if (items.length === 0) return out

  try {
    const text = await chat(
      llm,
      [
        { role: 'system', content: systemPrompt(locale, llm.extraSystem) },
        { role: 'user', content: validatePrompt(items, locale) },
      ],
      { jsonMode: true, signal },
    )
    const json = extractJSON<{ items?: Array<{ blockId: string; weatherFit?: number; closedOnDate?: boolean; notes?: string[] }> }>(
      text,
    )
    if (json?.items) {
      for (const it of json.items) {
        const prev = out.byBlockId[it.blockId] ?? {}
        out.byBlockId[it.blockId] = {
          ...prev,
          weatherFit: it.weatherFit,
          closedOnDate: it.closedOnDate,
          notes: it.notes,
        }
      }
    }
  } catch {
    // even if LLM fails, weather pre-fill is still useful
  }

  return out
}

// =============================================================================
// Helpers used by UI
// =============================================================================

export function makeEmptyBlock(): Block {
  return {
    id: uid('blk'),
    kind: 'sightseeing',
    title: '',
    place: { name: '' },
    granularity: 'flexible',
    daypart: 'ANY',
    locked: false,
  }
}
