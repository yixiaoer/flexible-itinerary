import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useSettings } from '../store/settings'
import { useTripStore } from '../store/trip'
import type { Trip, TripStatus } from '../types'
import { fmtDuration, shortDateLabel } from '../lib/time'
import { TRIP_STATUSES, tripStatus } from '../lib/tripStatus'
import { BlankState, Button, Drawer } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  onTripOpened: () => void
}

const labels = {
  zh: {
    title: '我的行程',
    subtitle: '每个行程档都会自动保存。点击卡片切换行程；保存版本会额外存一份快照。',
    newTrip: '新建空白行程',
    newTripHint: '创建后会立即出现在下方',
    saveCurrent: '保存版本',
    saveCurrentHint: '把当前编辑状态存为一个版本',
    importJson: '导入 JSON',
    importJsonHint: '从备份文件恢复一个行程',
    duplicate: '复制',
    export: '导出',
    delete: '删除',
    empty: '还没有行程',
    emptyHint: '新建空白行程、保存版本或导入 JSON 后，会出现在这里。',
    noCurrent: '当前没有可保存的行程。',
    importOk: '已导入行程。',
    saveOk: '已保存一个版本。',
    importFail: '导入失败：请选择有效的行程 JSON。',
    confirmDelete: '确认删除这个本地行程？',
    candidates: '候选',
    items: '活动',
    statusLabels: {
      past: '已出行',
      upcoming: '将出行',
      ongoing: '出行中',
      longTerm: '长期计划',
    },
  },
  en: {
    title: 'My Trips',
    subtitle: 'Each trip file auto-saves. Click a card to switch trips; Save version keeps an extra snapshot.',
    newTrip: 'New blank trip',
    newTripHint: 'It appears below immediately',
    saveCurrent: 'Save version',
    saveCurrentHint: 'Snapshot the current editing state',
    importJson: 'Import JSON',
    importJsonHint: 'Restore a trip from backup',
    duplicate: 'Duplicate',
    export: 'Export',
    delete: 'Delete',
    empty: 'No trips yet',
    emptyHint: 'Create a blank trip, save a version, or import JSON and it will appear here.',
    noCurrent: 'There is no current trip to save.',
    importOk: 'Trip imported.',
    saveOk: 'Version saved.',
    importFail: 'Import failed: choose a valid trip JSON file.',
    confirmDelete: 'Delete this local trip?',
    candidates: 'candidates',
    items: 'items',
    statusLabels: {
      past: 'Past',
      upcoming: 'Upcoming',
      ongoing: 'Traveling',
      longTerm: 'Long-term',
    },
  },
}

type LibraryLabels = typeof labels.zh

export function TripLibraryDrawer({ open, onClose, onTripOpened }: Props) {
  const locale = useSettings((s) => s.locale)
  const text = labels[locale]
  const trip = useTripStore((s) => s.trip)
  const library = useTripStore((s) => s.library)
  const loadLibraryTrip = useTripStore((s) => s.loadLibraryTrip)
  const deleteLibraryTrip = useTripStore((s) => s.deleteLibraryTrip)
  const duplicateLibraryTrip = useTripStore((s) => s.duplicateLibraryTrip)
  const importLibraryTrip = useTripStore((s) => s.importLibraryTrip)
  const setLibraryTripStatus = useTripStore((s) => s.setLibraryTripStatus)
  const saveTripToLibrary = useTripStore((s) => s.saveTripToLibrary)
  const createBlankTrip = useTripStore((s) => s.createBlankTrip)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const openTrip = (id: string) => {
    loadLibraryTrip(id)
    onTripOpened()
  }

  const duplicateTrip = (id: string) => {
    duplicateLibraryTrip(id)
    onTripOpened()
    onClose()
  }

  const startBlankTrip = () => {
    createBlankTrip()
    onTripOpened()
    onClose()
  }

  const saveCurrentTrip = () => {
    if (!trip) {
      setMessage(text.noCurrent)
      return
    }
    saveTripToLibrary(trip)
    setMessage(text.saveOk)
  }

  const exportTrip = (target: Trip | null | undefined) => {
    if (!target) {
      setMessage(text.noCurrent)
      return
    }
    const payload = {
      schema: 'flexible-itinerary.trip.v1',
      exportedAt: new Date().toISOString(),
      trip: target,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileSafeTripName(target)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed = parseTripPayload(JSON.parse(await file.text()))
      importLibraryTrip(parsed)
      setMessage(text.importOk)
      onTripOpened()
      onClose()
    } catch {
      setMessage(text.importFail)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Drawer open={open} title={text.title} onClose={onClose} className="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-ink-600">{text.subtitle}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="group rounded-3xl border border-brand-100/80 bg-white/75 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-card"
            onClick={startBlankTrip}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-900">{text.newTrip}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                +
              </span>
            </div>
            <div className="mt-1 text-caption leading-5 text-ink-500">{text.newTripHint}</div>
          </button>
          <button
            type="button"
            className="group rounded-3xl border border-brand-100/80 bg-white/75 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-card disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            onClick={saveCurrentTrip}
            disabled={!trip}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-900">{text.saveCurrent}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                ✓
              </span>
            </div>
            <div className="mt-1 text-caption leading-5 text-ink-500">{text.saveCurrentHint}</div>
          </button>
          <button
            type="button"
            className="group rounded-3xl border border-accent-100/80 bg-white/75 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent-200 hover:bg-white hover:shadow-card"
            onClick={() => fileRef.current?.click()}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink-900">{text.importJson}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition group-hover:bg-accent-100">
                ↑
              </span>
            </div>
            <div className="mt-1 text-caption leading-5 text-ink-500">{text.importJsonHint}</div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </div>

        {message && (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-2 text-sm text-ink-700">
            {message}
          </div>
        )}

        {library.length === 0 ? (
          <BlankState title={text.empty} description={text.emptyHint} className="bg-white/80" />
        ) : (
          <div className="space-y-3">
            {library.map((item) => (
              <TripLibraryItem
                key={item.id}
                trip={item}
                active={trip?.id === item.id}
                locale={locale}
                labels={text}
                onOpen={() => openTrip(item.id)}
                onDuplicate={() => duplicateTrip(item.id)}
                onExport={() => exportTrip(item)}
                onStatusChange={(status) => setLibraryTripStatus(item.id, status)}
                onDelete={() => {
                  if (confirm(text.confirmDelete)) deleteLibraryTrip(item.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}

function TripLibraryItem({
  trip,
  active,
  locale,
  labels,
  onOpen,
  onDuplicate,
  onExport,
  onStatusChange,
  onDelete,
}: {
  trip: Trip
  active: boolean
  locale: 'zh' | 'en'
  labels: LibraryLabels
  onOpen: () => void
  onDuplicate: () => void
  onExport: () => void
  onStatusChange: (status: TripStatus) => void
  onDelete: () => void
}) {
  const scheduled = trip.days.flatMap((day) => day.blocks)
  const totalDuration = scheduled.reduce((sum, block) => sum + (block.durationMin ?? 0), 0)
  const firstDate = trip.days.find((day) => day.date)?.date
  const status = tripStatus(trip)
  const title = trip.meta.title || trip.meta.countries.join(', ') || (locale === 'zh' ? '未命名行程' : 'Untitled trip')
  const summary = [
    trip.meta.countries.join(', '),
    firstDate ? shortDateLabel(firstDate, locale) : undefined,
    `${scheduled.length} ${labels.items}`,
    `${trip.unscheduled.length} ${labels.candidates}`,
    fmtDuration(totalDuration, locale),
  ].filter(Boolean).join(' · ')

  const runControl = (event: MouseEvent, action: () => void) => {
    event.stopPropagation()
    action()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={`group cursor-pointer rounded-3xl border p-4 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-card focus-visible:ring-2 focus-visible:ring-brand-200 ${
        active
          ? 'border-brand-300 bg-gradient-to-br from-brand-50/90 via-white to-accent-50/70 ring-2 ring-brand-100'
          : 'border-white/80 bg-white/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink-900">{title}</h3>
            {active && <span className="chip-brand">{locale === 'zh' ? '当前' : 'Current'}</span>}
          </div>
          <p className="mt-1 text-caption text-ink-500">{summary}</p>
          <p className="mt-1 text-caption text-ink-400">
            {new Date(trip.updatedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
          </p>
        </div>
        <select
          className={`shrink-0 rounded-full border px-2.5 py-1 text-caption font-semibold outline-none transition ${statusTone(status)}`}
          value={status}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onStatusChange(event.target.value as TripStatus)}
          aria-label={locale === 'zh' ? '行程状态' : 'Trip status'}
        >
          {TRIP_STATUSES.map((item) => (
            <option key={item} value={item}>
              {labels.statusLabels[item]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={(event) => runControl(event, onDuplicate)}>{labels.duplicate}</Button>
        <Button size="sm" variant="outline" onClick={(event) => runControl(event, onExport)}>{labels.export}</Button>
        <Button size="sm" variant="quiet" className="text-red-600 hover:text-red-700" onClick={(event) => runControl(event, onDelete)}>{labels.delete}</Button>
      </div>
    </article>
  )
}

function parseTripPayload(value: unknown): Trip {
  const source = value as { trip?: unknown }
  const candidate = (source?.trip ?? value) as Partial<Trip> | undefined
  if (!candidate || typeof candidate !== 'object') throw new Error('Invalid trip')
  if (!candidate.meta || !Array.isArray(candidate.days)) throw new Error('Invalid trip')
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `imported-${Date.now()}`,
    meta: {
      title: candidate.meta.title ?? '',
      countries: Array.isArray(candidate.meta.countries) ? candidate.meta.countries : [],
      mustVisit: Array.isArray(candidate.meta.mustVisit) ? candidate.meta.mustVisit : [],
      vibes: Array.isArray(candidate.meta.vibes) ? candidate.meta.vibes : [],
      numDays: typeof candidate.meta.numDays === 'number' ? candidate.meta.numDays : candidate.days.length,
      startDate: candidate.meta.startDate,
      origin: candidate.meta.origin,
      travelers: candidate.meta.travelers,
      statusOverride: isTripStatus(candidate.meta.statusOverride) ? candidate.meta.statusOverride : undefined,
    },
    days: candidate.days,
    unscheduled: Array.isArray(candidate.unscheduled) ? candidate.unscheduled : [],
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === 'string' && TRIP_STATUSES.includes(value as TripStatus)
}

function statusTone(status: TripStatus) {
  if (status === 'past') return 'border-ink-200 bg-ink-50 text-ink-600'
  if (status === 'ongoing') return 'border-brand-200 bg-brand-50 text-brand-700'
  if (status === 'upcoming') return 'border-accent-200 bg-accent-50 text-accent-600'
  return 'border-violet-200 bg-violet-50 text-violet-700'
}

function fileSafeTripName(trip: Trip) {
  const name = trip.meta.title || trip.meta.countries.join('-') || 'trip'
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'trip'
}
