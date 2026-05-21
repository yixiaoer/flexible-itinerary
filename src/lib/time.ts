import type { Block, Daypart } from '../types'

export type TimedDaypart = Exclude<Daypart, 'ANY'>

export const DAYPART_DEFAULT_RANGE: Record<TimedDaypart, [string, string]> = {
  AM: ['09:00', '12:00'],
  PM: ['13:00', '18:00'],
  EVE: ['18:30', '22:00'],
}

export function dayparts(): Daypart[] {
  return ['ANY', 'AM', 'PM', 'EVE']
}

export function parseHHMM(s?: string): number | undefined {
  if (!s) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return undefined
  return h * 60 + mm
}

export function fmtHHMM(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function fmtDuration(min: number | undefined, locale: 'zh' | 'en'): string {
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (locale === 'zh') {
    if (h && m) return `${h} 小时 ${m} 分钟`
    if (h) return `${h} 小时`
    return `${m} 分钟`
  }
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** Returns the daypart bucket a block falls into (for layout grouping). */
export function blockDaypart(block: Block): Daypart {
  if (block.granularity === 'flexible' && block.daypart) return block.daypart
  const t = parseHHMM(block.startTime)
  if (t === undefined) return block.daypart ?? 'AM'
  if (t < 12 * 60) return 'AM'
  if (t < 18 * 60) return 'PM'
  return 'EVE'
}

/** Sort key: time-bound (window/precise) first by start, flexible by daypart default. */
export function blockSortKey(b: Block): number {
  if ((b.granularity === 'precise' || b.granularity === 'window') && b.startTime) {
    const t = parseHHMM(b.startTime)
    if (t !== undefined) return t
  }
  const dp = b.daypart ?? blockDaypart(b)
  if (dp === 'ANY') return 10 * 60
  const t = parseHHMM(DAYPART_DEFAULT_RANGE[dp][0])
  return t ?? 0
}

export function weekdayLabel(iso: string, locale: 'zh' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d)
  const idx = dt.getDay()
  if (locale === 'zh') {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][idx] ?? ''
  }
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx] ?? ''
}

export function shortDateLabel(iso: string, locale: 'zh' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  if (locale === 'zh') return `${m}月${d}日`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d}`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
