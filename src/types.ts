// =============================================================================
// Core data model for the flexible itinerary planner.
//
// Design intent:
// - A Trip has N Days; each Day has Blocks.
// - A Block can be "rough" (daypart AM/PM/EVE, or ANY for no daypart)
//   (an explicit start/end time). Rough and precise blocks can coexist on the
//   same day, so users can be very-J on one item and very-P on the next.
// - Any Block can be `locked`: AI replanners must treat it as a hard constraint
//   (its time/place/duration cannot move). Use `lockReason` to explain why.
// - `evidence` is filled in by the validation pass (weather + open-hours +
//   indoor/outdoor sanity check). It is never authoritative input — it is a
//   confidence/credibility layer surfaced in the UI.
// =============================================================================

export type Daypart = 'ANY' | 'AM' | 'PM' | 'EVE'

export type TripStatus = 'past' | 'upcoming' | 'ongoing' | 'longTerm'

/**
 * Three levels of time precision the user can express, mixable inside the
 * same day.
 *
 * - `flexible`  : "灵活" — optionally has a daypart hint (AM/PM/EVE).
 *                 `ANY` means no semantic time bucket is set.
 * - `window`    : "时间窗" — bounded range [startTime, endTime]. AI must keep
 *                 the activity inside this window but the exact slot is soft.
 * - `precise`   : "精确" — the user pinned an exact start time. AI must use
 *                 this exact start.
 */
export type Granularity = 'flexible' | 'window' | 'precise'

export type ActivityKind =
  | 'sightseeing'
  | 'food'
  | 'transport'
  | 'flight'
  | 'train'
  | 'hotel'
  | 'show'
  | 'outdoor'
  | 'indoor'
  | 'rest'
  | 'other'

export interface Place {
  name: string
  /** Free-form short intro shown in the card. */
  intro?: string
  /** Optional address / district hint to help geocoding. */
  address?: string
  lat?: number
  lng?: number
  /** Indoor / outdoor matters for weather conflict check. */
  indoor?: boolean
  /** "09:00-18:00" style or "全天" / "24h"; pre-filled by AI estimate, refined by validation. */
  openHoursHint?: string
}

export interface Evidence {
  /** Last time this evidence was computed (ISO). */
  checkedAt?: string
  /** Forecast headline like "晴 28°C" / "Rain 60%". */
  weatherSummary?: string
  /** 0–100. Higher = better fit (e.g. outdoor on sunny day → high). */
  weatherFit?: number
  /** True if the place is reportedly closed on the planned date (e.g. weekly rest day). */
  closedOnDate?: boolean
  /** Notes / warnings to render under the card. */
  notes?: string[]
}

export interface Block {
  id: string
  kind: ActivityKind
  /** Display title (e.g. "金阁寺", "Tsukiji 早餐", "JR 京都→大阪"). */
  title: string
  place?: Place
  granularity: Granularity
  /** Used when granularity === 'flexible'. */
  daypart?: Daypart
  /** Used when granularity === 'window' or 'precise'. "HH:mm" 24h. */
  startTime?: string
  endTime?: string
  /** Optional estimated duration in minutes; valid in both rough and precise modes when present. */
  durationMin?: number
  /** AI / user notes (e.g. "JR Pass 可用", "记得带防晒"). */
  notes?: string
  /** If true, replanners MUST NOT modify time/place/duration of this block. */
  locked: boolean
  lockReason?: string
  /** If true, this is a "nice-to-have" — AI may drop it under time pressure. */
  optional?: boolean
  evidence?: Evidence
}

export interface Day {
  id: string
  /** ISO date "YYYY-MM-DD" if user provided dates; otherwise undefined and we show "Day N". */
  date?: string
  /** 1-based index used when no concrete dates are given. */
  index: number
  blocks: Block[]
  /** Day-level free-form note (e.g. "今天专程为看烟花"). */
  note?: string
}

export interface TripMeta {
  title: string
  /** Free-form list of countries / regions, e.g. ["日本", "Kyoto"]. */
  countries: string[]
  /** Optional anchor places the user explicitly wants to include. */
  mustVisit: string[]
  /**
   * Vibes / preferences as discrete chips (e.g. "悠闲", "美食体验", "少走路").
   * Easier to reason about than one big paragraph; rendered as removable chips.
   */
  vibes: string[]
  /** ISO start date if known, else undefined. */
  startDate?: string
  /** Number of days. */
  numDays: number
  /** Origin city / airport, helps the AI reason about transport days. */
  origin?: string
  /** Travelers count (helpful for AI to avoid over-suggesting solo-only spots). */
  travelers?: number
  /** Optional manual library tag. If absent, the UI infers status from dated days. */
  statusOverride?: TripStatus
}

export interface Trip {
  id: string
  meta: TripMeta
  days: Day[]
  /**
   * "Candidates pool" — places the user wants to consider but hasn't pinned to
   * a specific day. Used for two flows:
   *  1. Pure-manual: user dumps must-visit places here, drags them to days.
   *  2. AI-augmented: AI fills `days` and adds "nice-to-have" suggestions here.
   * Drag-and-drop moves blocks between this pool and any day.
   */
  unscheduled: Block[]
  /** Last update ISO timestamp. */
  updatedAt: string
}

/** Special sentinel id for the candidates pool in dnd-kit operations. */
export const UNSCHEDULED_ID = '__unscheduled__'

// =============================================================================
// Settings
// =============================================================================

export type Locale = 'zh' | 'en'

export interface LLMSettings {
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1
   *  Works with DeepSeek / Moonshot / Qwen / OpenRouter / 本地 vLLM 等. */
  baseUrl: string
  apiKey: string
  model: string
  /** Optional system prompt suffix to bias style. */
  extraSystem?: string
  temperature?: number
}

export interface AppSettings {
  locale: Locale
  llm: LLMSettings
}
