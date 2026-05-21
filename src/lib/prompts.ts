// Prompt templates + JSON schema documentation we send to the LLM.
//
// We never trust LLM output blindly: every response is JSON-validated and
// shape-coerced (see `coerceTrip` / `coerceBlocks` below). Locked blocks are
// reinjected from local state after replans.

import type { Block, Day, Trip, TripMeta } from '../types'
import { uid } from './id'

const BLOCK_SHAPE_DOC = `
A "block" is one item on the itinerary. JSON shape:
{
  "id": string,                           // unique
  "kind": "sightseeing" | "food" | "transport" | "flight" | "train" | "hotel" | "show" | "outdoor" | "indoor" | "rest" | "other",
  "title": string,                        // short display title in user's language
  "place": {
    "name": string,
    "intro": string,                      // 1–2 sentences why it's worth, in user's language
    "address": string,                    // city / district / landmark hint, helpful for geocoding
    "indoor": boolean                     // true for museums/halls; false for parks/streets
  },
  "granularity": "flexible" | "window" | "precise",
  "daypart": "AM" | "PM" | "EVE" | "ANY", // present when granularity = "flexible"; ANY = no fixed daypart
  "startTime": "HH:mm",                   // present when granularity = "window" or "precise"
  "endTime": "HH:mm",                     // present when granularity = "window" or "precise"
  "durationMin": number | omitted,        // optional estimated time at this place, in minutes
  "notes": string,                        // tips, transit hints, vibe response
  "locked": false,                        // user toggles this manually
  "optional": false,                      // set true for "nice to have" extras
  "openHoursHint": "09:00-17:00" | "全天" | ""   // best-known typical hours
}
Granularity guidance:
- Default to "flexible" with a daypart for most sightseeing / food.
- Use "window" when the slot has a natural bound (e.g. "下午博物馆 13:00-16:00").
- Use "precise" only for items with real timetables: flights, trains, show tickets, sunrise.
`.trim()

const TRIP_SHAPE_DOC = `
The full itinerary JSON shape:
{
  "days": [
    {
      "index": number,             // 1-based
      "date": "YYYY-MM-DD" | null, // null if user did not give a start date
      "note": string,              // optional day-level note (e.g. "今天专程为看烟花")
      "blocks": Block[]            // 3–6 blocks per day typical; mix kinds
    }
  ],
  "candidates": Block[]            // OPTIONAL: 0–6 "nice-to-have" extras the user
                                   // can swap in if they have spare time. These
                                   // are NOT placed on any specific day. Treat
                                   // them as candidates, with daypart hints only.
}
`.trim()

export interface RawBlock {
  id?: string
  kind?: string
  title?: string
  place?: {
    name?: string
    intro?: string
    address?: string
    indoor?: boolean
    lat?: number
    lng?: number
    openHoursHint?: string
  }
  granularity?: 'flexible' | 'window' | 'precise' | 'rough' | string
  optional?: boolean
  daypart?: 'ANY' | 'AM' | 'PM' | 'EVE' | string
  startTime?: string
  endTime?: string
  durationMin?: number
  notes?: string
  locked?: boolean
  openHoursHint?: string
}

export interface RawDay {
  index?: number
  date?: string | null
  note?: string
  blocks?: RawBlock[]
}

export interface RawTripPayload {
  days?: RawDay[]
  candidates?: RawBlock[]
}

const VALID_KINDS = new Set([
  'sightseeing',
  'food',
  'transport',
  'flight',
  'train',
  'hotel',
  'show',
  'outdoor',
  'indoor',
  'rest',
  'other',
])

export function coerceBlock(raw: RawBlock): Block {
  const kind = (raw.kind && VALID_KINDS.has(raw.kind) ? raw.kind : 'sightseeing') as Block['kind']
  // Treat legacy "rough" as the new "flexible".
  const rawG = raw.granularity === 'rough' ? 'flexible' : raw.granularity
  const granularity: Block['granularity'] =
    rawG === 'precise' ? 'precise' : rawG === 'window' ? 'window' : 'flexible'
  const daypart =
    raw.daypart === 'ANY' || raw.daypart === 'AM' || raw.daypart === 'PM' || raw.daypart === 'EVE'
      ? raw.daypart
      : 'AM'
  const hasTime = granularity === 'precise' || granularity === 'window'
  return {
    id: raw.id || uid('blk'),
    kind,
    title: String(raw.title ?? '').trim() || '(untitled)',
    place: {
      name: raw.place?.name ?? '',
      intro: raw.place?.intro,
      address: raw.place?.address,
      indoor: raw.place?.indoor,
      lat: typeof raw.place?.lat === 'number' ? raw.place.lat : undefined,
      lng: typeof raw.place?.lng === 'number' ? raw.place.lng : undefined,
      openHoursHint: raw.place?.openHoursHint ?? raw.openHoursHint,
    },
    granularity,
    daypart: granularity === 'flexible' ? daypart : undefined,
    startTime: hasTime ? raw.startTime : undefined,
    endTime: hasTime ? raw.endTime : undefined,
    durationMin: raw.durationMin === undefined || raw.durationMin === null ? undefined : clampInt(raw.durationMin, 15, 12 * 60, 90),
    notes: raw.notes,
    locked: Boolean(raw.locked),
    optional: Boolean(raw.optional),
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function coerceDays(raw: RawTripPayload, expectDays: number, startDate?: string): Day[] {
  const list = Array.isArray(raw.days) ? raw.days : []
  const days: Day[] = []
  for (let i = 0; i < expectDays; i++) {
    const r = list[i] ?? {}
    days.push({
      id: uid('day'),
      index: i + 1,
      date: startDate
        ? offsetDate(startDate, i)
        : (typeof r.date === 'string' && r.date) || undefined,
      note: r.note,
      blocks: (r.blocks ?? []).map(coerceBlock),
    })
  }
  return days
}

function offsetDate(start: string, days: number): string {
  const [y, m, d] = start.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// =============================================================================
// Prompt builders
// =============================================================================

function localeWord(locale: 'zh' | 'en') {
  return locale === 'zh' ? '中文' : 'English'
}

export function systemPrompt(locale: 'zh' | 'en', extra?: string): string {
  return [
    `You are a senior travel planner. Always reply in ${localeWord(locale)}.`,
    `Output STRICT JSON only — no markdown, no commentary outside JSON.`,
    `Be specific: prefer concrete place names users can search. Avoid hallucinating closed/non-existent venues.`,
    `Respect user vibes: e.g. "悠闲" → fewer blocks, longer durations; "特种兵" → packed schedule, short durations; "少走路" → cluster geographically; "拍照好看" → photogenic spots, short stays elsewhere.`,
    `Default time estimates: museum 90–120m, large temple/shrine 60–90m, street/market 60–90m, viewpoint 30–60m, sit-down meal 60–90m, casual food 30m, light hike 90–180m.`,
    `If a user lists "must-visit" places, INCLUDE ALL of them somewhere in the plan.`,
    extra?.trim() ? `Extra user instructions: ${extra.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function generatePrompt(meta: TripMeta, locale: 'zh' | 'en'): string {
  const lines = [
    `Generate a ${meta.numDays}-day itinerary as JSON. Reply in ${localeWord(locale)}.`,
    `Countries / regions: ${meta.countries.join(', ') || '(unspecified)'}.`,
    meta.origin ? `Origin: ${meta.origin}.` : '',
    meta.travelers ? `Travelers: ${meta.travelers}.` : '',
    meta.startDate ? `Start date: ${meta.startDate}.` : `No start date — use index only.`,
    meta.mustVisit.length
      ? `Must include all of these places (split sensibly across days, cluster geographically): ${meta.mustVisit.join('; ')}.`
      : '',
    meta.vibes.length ? `Style / special requests: ${meta.vibes.join('; ')}` : '',
    ``,
    `Constraints:`,
    `- 3–6 blocks per day. Mix kinds: a meal block, sightseeing, optional rest/transport.`,
    `- Default most blocks to "flexible" granularity (with daypart AM/PM/EVE).`,
    `- Use "window" for items naturally bound to a slot (e.g. dinner 18:30-20:30, museum 13:00-16:00). Provide startTime + endTime.`,
    `- Use "precise" only for items with real timetables (flights, trains, show tickets, sunrise). Provide startTime + endTime.`,
    `- Set "optional": true for sights that are nice-to-have / skippable.`,
    `- Set durationMin realistically when you can estimate it; omit it when duration is genuinely unclear. Total per day should stay ≤ 12h of activity when durations are provided.`,
    `- All blocks "locked": false (user will lock manually).`,
    `- ALSO suggest 3–6 "candidates" — extra worth-considering places the user can swap in. Put them in the top-level "candidates" array (NOT inside any day). Use granularity "flexible" with a daypart hint.`,
    `- Respond with the JSON object described in the schema. No prose.`,
    ``,
    `Schema:`,
    TRIP_SHAPE_DOC,
    ``,
    `Block shape:`,
    BLOCK_SHAPE_DOC,
  ]
  return lines.filter(Boolean).join('\n')
}

export interface ReplanContext {
  trip: Trip
  /** Day to focus on. If undefined → replan whole trip. */
  focusDayId?: string
  /** User's free-form description of new constraints / situation. */
  situation: string
}

export function replanPrompt(ctx: ReplanContext, locale: 'zh' | 'en'): string {
  const langLine = `Reply in ${localeWord(locale)}.`
  const focusDay = ctx.focusDayId
    ? ctx.trip.days.find((d) => d.id === ctx.focusDayId)
    : undefined

  const lockedSummary = ctx.trip.days
    .flatMap((d) =>
      d.blocks
        .filter((b) => b.locked)
        .map((b) => `  - Day ${d.index}${d.date ? ` (${d.date})` : ''}: ${describeBlock(b)} [LOCKED${b.lockReason ? `: ${b.lockReason}` : ''}]`),
    )
    .join('\n')

  const tripJson = JSON.stringify(stripForLLM(ctx.trip), null, 2)
  const lines = [
    langLine,
    focusDay
      ? `Replan ONLY day index ${focusDay.index}${focusDay.date ? ` (${focusDay.date})` : ''}.`
      : `Replan the entire trip from now on.`,
    ``,
    `User's current situation / desired change:`,
    `"${ctx.situation || '(none)'}"`,
    ``,
    `LOCKED items (DO NOT MOVE OR MODIFY their time, place, or duration; the rest must flow around them):`,
    lockedSummary || '  (none)',
    ``,
    `Current itinerary JSON:`,
    tripJson,
    ``,
    `Output the SAME schema (`,
    `{ "days": [...] }`,
    `).`,
    focusDay
      ? `Return ALL days unchanged except the focus day, OR return only the focus day inside "days" with its index. Either is fine; preserve "id" if you can.`
      : `Return all ${ctx.trip.days.length} days.`,
    `For locked blocks, copy them through verbatim, preserving "id" and locked=true.`,
    `Respond with JSON only.`,
    ``,
    `Schema reminder:`,
    TRIP_SHAPE_DOC,
    BLOCK_SHAPE_DOC,
  ]
  return lines.filter(Boolean).join('\n')
}

function describeBlock(b: Block): string {
  const time =
    b.granularity === 'precise' || b.granularity === 'window'
      ? `${b.startTime ?? '?'}–${b.endTime ?? '?'}`
      : b.daypart ?? '?'
  return `${time} ${b.title}${b.durationMin ? ` (${b.durationMin}m)` : ''}`
}

/** Strip volatile / heavy fields before sending to the LLM. */
function stripForLLM(trip: Trip) {
  return {
    meta: trip.meta,
    days: trip.days.map((d) => ({
      id: d.id,
      index: d.index,
      date: d.date,
      note: d.note,
      blocks: d.blocks.map((b) => ({
        id: b.id,
        kind: b.kind,
        title: b.title,
        place: b.place,
        granularity: b.granularity,
        daypart: b.daypart,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMin: b.durationMin,
        notes: b.notes,
        locked: b.locked,
        lockReason: b.lockReason,
        optional: b.optional,
      })),
    })),
  }
}

// =============================================================================
// Validation prompt — for evidence layer.
// We ask the LLM to assess each block against weather + open-hours sanity.
// Weather data is fed in from Open-Meteo so the LLM doesn't have to guess.
// =============================================================================

export interface ValidateInputBlock {
  blockId: string
  dayIndex: number
  date?: string
  title: string
  place?: string
  indoor?: boolean
  weather?: string // pre-fetched headline
}

export interface ValidateOutputItem {
  blockId: string
  weatherFit?: number // 0..100
  closedOnDate?: boolean
  notes?: string[]
}

export function validatePrompt(
  items: ValidateInputBlock[],
  _locale: 'zh' | 'en',
): string {
  return [
    `For each itinerary block below, assess credibility based on the (real) weather provided and your knowledge of typical opening hours.`,
    `Reply with JSON only:`,
    `{ "items": [ { "blockId": string, "weatherFit": number /* 0-100 */, "closedOnDate": boolean, "notes": string[] } ] }`,
    `weatherFit: 100 = ideal (e.g. outdoor on sunny day), 50 = acceptable, 0 = strong conflict (e.g. outdoor activity on heavy-rain day).`,
    `notes: short, specific warnings/tips. Keep total notes ≤ 2 per block.`,
    ``,
    `Blocks:`,
    JSON.stringify(items, null, 2),
  ].join('\n')
}

// =============================================================================
// Candidate suggestions: append extra ideas to the user's existing trip.
// Used by the "AI suggest more places" button. Does NOT place anything on a
// specific day — output goes to the candidates pool.
// =============================================================================

export function suggestCandidatesPrompt(trip: Trip, locale: 'zh' | 'en'): string {
  const langLine = `Reply in ${localeWord(locale)}.`
  const haveTitles = [
    ...trip.days.flatMap((d) => d.blocks.map((b) => b.title)),
    ...trip.unscheduled.map((b) => b.title),
  ]
  return [
    langLine,
    `Suggest 4–8 additional worth-considering places for this trip. They are CANDIDATES only — DO NOT assign them to any day.`,
    `They should fit the user's destinations and vibes; skip anything geographically far from current itinerary.`,
    `Avoid duplicating these existing items: ${haveTitles.join('; ') || '(none)'}.`,
    ``,
    `Trip context:`,
    JSON.stringify(
      {
        meta: trip.meta,
        existingDays: trip.days.map((d) => ({
          index: d.index,
          date: d.date,
          blockTitles: d.blocks.map((b) => b.title),
        })),
      },
      null,
      2,
    ),
    ``,
    `Output JSON only:`,
    `{ "candidates": Block[] }`,
    `Each Block uses granularity "flexible" with a daypart hint, no startTime / endTime.`,
    BLOCK_SHAPE_DOC,
  ].join('\n')
}
