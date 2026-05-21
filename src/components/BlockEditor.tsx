import { useState } from 'react'
import type { ActivityKind, Block, Daypart, Granularity } from '../types'
import { UNSCHEDULED_ID } from '../types'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t, type MessageKey } from '../i18n/messages'
import { DAYPART_DEFAULT_RANGE, fmtHHMM, parseHHMM } from '../lib/time'
import { Button, FormSection, Modal, OptionTileGroup, type OptionTile } from './ui'

interface Props {
  dayId: string
  block: Block
  onClose: () => void
}

const KIND_KEYS: { value: ActivityKind; key: MessageKey }[] = [
  { value: 'sightseeing', key: 'kindSightseeing' },
  { value: 'food', key: 'kindFood' },
  { value: 'transport', key: 'kindTransport' },
  { value: 'flight', key: 'kindFlight' },
  { value: 'train', key: 'kindTrain' },
  { value: 'hotel', key: 'kindHotel' },
  { value: 'show', key: 'kindShow' },
  { value: 'outdoor', key: 'kindOutdoor' },
  { value: 'indoor', key: 'kindIndoor' },
  { value: 'rest', key: 'kindRest' },
  { value: 'other', key: 'kindOther' },
]

export function BlockEditor({ dayId, block, onClose }: Props) {
  const locale = useSettings((s) => s.locale)
  const patchBlock = useTripStore((s) => s.patchBlock)
  const setDaypartBoundary = useTripStore((s) => s.setDaypartBoundary)

  const [draft, setDraft] = useState<Block>(block)
  const [durationText, setDurationText] = useState(() => block.durationMin === undefined ? '' : String(block.durationMin))

  const update = (patch: Partial<Block>) => setDraft({ ...draft, ...patch })
  const readDuration = () => {
    const n = Number(durationText)
    if (!durationText || !Number.isFinite(n)) return undefined
    return Math.max(5, Math.min(1440, Math.floor(n)))
  }
  const commitDuration = () => {
    const next = readDuration()
    setDurationText(next === undefined ? '' : String(next))
    update({ durationMin: next })
    return next
  }

  const setGranularity = (g: Granularity) => {
    if (g === draft.granularity) return
    if (g === 'flexible') {
      const t0 = parseHHMM(draft.startTime ?? '09:00') ?? 9 * 60
      const dp: Daypart = t0 < 12 * 60 ? 'AM' : t0 < 18 * 60 ? 'PM' : 'EVE'
      update({
        granularity: 'flexible',
        daypart: dp,
        startTime: undefined,
        endTime: undefined,
      })
      return
    }
    const fallbackDP = draft.daypart && draft.daypart !== 'ANY' ? draft.daypart : 'AM'
    const [s, e] = DAYPART_DEFAULT_RANGE[fallbackDP]
    const startMin = parseHHMM(draft.startTime ?? s) ?? parseHHMM(s)!
    const endMin = parseHHMM(draft.endTime ?? '') ?? Math.min(startMin + (draft.durationMin ?? 90), parseHHMM(e)! + 240)
    update({
      granularity: g,
      startTime: fmtHHMM(startMin),
      endTime: fmtHHMM(endMin),
      daypart: undefined,
    })
  }

  const onTimeChange = (which: 'startTime' | 'endTime', v: string) => {
    const next: Partial<Block> = { [which]: v }
    const start = parseHHMM(which === 'startTime' ? v : draft.startTime ?? '')
    const end = parseHHMM(which === 'endTime' ? v : draft.endTime ?? '')
    if (start !== undefined && end !== undefined && end > start) {
      next.durationMin = end - start
    }
    update(next)
  }

  const save = () => {
    const durationMin = readDuration()
    patchBlock(dayId, draft.id, { ...draft, durationMin })
    if (
      dayId !== UNSCHEDULED_ID &&
      draft.granularity === 'flexible' &&
      draft.daypart &&
      draft.daypart !== block.daypart
    ) {
      setDaypartBoundary(dayId, draft.id, draft.daypart)
    }
    onClose()
  }

  const granOptions: Array<OptionTile<Granularity>> = [
    {
      value: 'flexible',
      label: t(locale, 'gFlexible'),
      description: t(locale, 'gFlexibleDesc'),
      activeClassName: 'data-[active=true]:border-brand-300 data-[active=true]:bg-brand-50/70 data-[active=true]:text-brand-800',
    },
    {
      value: 'window',
      label: t(locale, 'gWindow'),
      description: t(locale, 'gWindowDesc'),
      activeClassName: 'data-[active=true]:border-accent-400/70 data-[active=true]:bg-accent-50/70 data-[active=true]:text-ink-800',
    },
    {
      value: 'precise',
      label: t(locale, 'gPrecise'),
      description: t(locale, 'gPreciseDesc'),
      activeClassName: 'data-[active=true]:border-brand-400/70 data-[active=true]:bg-white/80 data-[active=true]:text-ink-900',
    },
  ]

  const showTimeFields = draft.granularity === 'window' || draft.granularity === 'precise'

  return (
    <Modal
      title={t(locale, 'editBlock')}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      bodyClassName="space-y-5"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button variant="primary" onClick={save}>
            {t(locale, 'save')}
          </Button>
        </>
      }
    >
      <FormSection label={t(locale, 'title')}>
        <input
          className="input"
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={t(locale, 'titlePh')}
        />
      </FormSection>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormSection label={t(locale, 'activityKind')}>
          <select
            className="input"
            value={draft.kind}
            onChange={(e) => update({ kind: e.target.value as ActivityKind })}
          >
            {KIND_KEYS.map(({ value, key }) => (
              <option key={value} value={value}>
                {String(t(locale, key))}
              </option>
            ))}
          </select>
        </FormSection>
        <FormSection label={`${t(locale, 'duration')} (${t(locale, 'durationUnit')})`}>
          <input
            className="input"
            type="number"
            min={5}
            max={1440}
            step={5}
            value={durationText}
            onChange={(e) => setDurationText(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitDuration}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
        </FormSection>
      </div>

      <FormSection label={t(locale, 'address')}>
        <input
          className="input"
          value={draft.place?.name ?? ''}
          onChange={(e) => update({ place: { ...draft.place, name: e.target.value } })}
          placeholder={t(locale, 'addressPh')}
        />
      </FormSection>

      <FormSection label={t(locale, 'intro')}>
        <textarea
          className="input min-h-[64px] resize-y"
          value={draft.place?.intro ?? ''}
          onChange={(e) =>
            update({
              place: {
                ...draft.place,
                name: draft.place?.name ?? '',
                intro: e.target.value,
              },
            })
          }
          placeholder={t(locale, 'introPh')}
        />
      </FormSection>

      <FormSection label={t(locale, 'notes')}>
        <textarea
          className="input min-h-[64px] resize-y"
          value={draft.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t(locale, 'notesPh')}
        />
      </FormSection>

      <FormSection label={t(locale, 'granularity')}>
        <OptionTileGroup options={granOptions} value={draft.granularity} onChange={setGranularity} />

        <div className="mt-3">
          {draft.granularity === 'flexible' ? (
            <FormSection label={t(locale, 'daypartLabel')}>
              <select
                className="input"
                value={draft.daypart ?? 'ANY'}
                onChange={(e) => update({ daypart: e.target.value as Daypart })}
              >
                <option value="ANY">{t(locale, 'daypartFlexible')}</option>
                <option value="AM">{t(locale, 'morning')}</option>
                <option value="PM">{t(locale, 'afternoon')}</option>
                <option value="EVE">{t(locale, 'evening')}</option>
              </select>
            </FormSection>
          ) : showTimeFields ? (
            <div className="flex items-center gap-3">
              <FormSection label={t(locale, 'startTime')} className="flex-1">
                <input
                  type="time"
                  className="input"
                  value={draft.startTime ?? ''}
                  onChange={(e) => onTimeChange('startTime', e.target.value)}
                />
              </FormSection>
              <span className="mt-5 text-ink-400">→</span>
              <FormSection label={t(locale, 'endTime')} className="flex-1">
                <input
                  type="time"
                  className="input"
                  value={draft.endTime ?? ''}
                  onChange={(e) => onTimeChange('endTime', e.target.value)}
                />
              </FormSection>
            </div>
          ) : null}
        </div>
      </FormSection>

      <div className="rounded-3xl border border-brand-100/70 bg-white/88 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            variant={draft.locked ? 'primary' : 'outline'}
            onClick={() => update({ locked: !draft.locked })}
          >
            {draft.locked ? t(locale, 'locked') : t(locale, 'lock')}
          </Button>
          <Button
            variant="outline"
            className={draft.optional ? 'border-amber-300 text-amber-700' : ''}
            onClick={() => update({ optional: !draft.optional })}
            title={t(locale, 'optionalTip')}
          >
            {draft.optional ? `✓ ${t(locale, 'optional')}` : t(locale, 'markOptional')}
          </Button>
        </div>
        <input
          className="input"
          value={draft.lockReason ?? ''}
          onChange={(e) => update({ lockReason: e.target.value })}
          placeholder={t(locale, 'lockReasonPh')}
          disabled={!draft.locked}
        />
      </div>
    </Modal>
  )
}
