import { useEffect, useState } from 'react'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { replanTrip } from '../lib/planner'
import { shortDateLabel } from '../lib/time'
import { Alert, Button, ErrorState, Modal } from './ui'

interface Props {
  open: boolean
  /** If provided, replan only this day. */
  dayId?: string
  onClose: () => void
}

export function DisruptionDialog({ open, dayId, onClose }: Props) {
  const locale = useSettings((s) => s.locale)
  const llm = useSettings((s) => s.llm)
  const trip = useTripStore((s) => s.trip)
  const replaceDays = useTripStore((s) => s.replaceDays)

  const [situation, setSituation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSituation('')
      setError(null)
    }
  }, [open])

  if (!open || !trip) return null

  const focusDay = dayId ? trip.days.find((d) => d.id === dayId) : undefined
  const focusLabel = focusDay
    ? focusDay.date
      ? shortDateLabel(focusDay.date, locale)
      : t(locale, 'dayBadge')(focusDay.index)
    : ''

  const submit = async () => {
    if (!llm.apiKey) {
      setError(t(locale, 'fillKeyFirst'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await replanTrip(
        { trip, situation, focusDayId: dayId },
        llm,
        locale,
      )
      replaceDays(r.days)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t(locale, 'replanTitle')}
      onClose={onClose}
      maxWidthClassName="max-w-lg"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? t(locale, 'generating') : t(locale, 'replanGo')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600">
        {dayId
          ? t(locale, 'replanFocusOnly')(focusLabel)
          : t(locale, 'replanScopeAll')}
      </p>

      <div>
        <label className="label">{t(locale, 'replanContextLabel')}</label>
        <textarea
          className="input min-h-[110px] resize-y"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder={t(locale, 'replanContextPh')}
        />
      </div>

      <Alert variant="warning">{t(locale, 'replanLockNotice')}</Alert>

      {error && <ErrorState message={error} />}
    </Modal>
  )
}
