import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { DayColumn } from './DayColumn'
import { BlockEditor } from './BlockEditor'
import { DisruptionDialog } from './DisruptionDialog'
import { StatusBar } from './StatusBar'
import { CandidatesStrip } from './CandidatesStrip'
import { validateTrip } from '../lib/planner'
import { UNSCHEDULED_ID, type Block } from '../types'
import { fmtDuration, shortDateLabel } from '../lib/time'
import type { Tab } from '../App'
import { PageHeader } from './layout'
import { BlankState, BrandMark, Button, ErrorState, LoadingState, Modal } from './ui'

interface Props {
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onSwitchTab: (tab: Tab) => void
}

export function BoardView({ selectedBlockId, onSelectBlock, onSwitchTab }: Props) {
  const trip = useTripStore((s) => s.trip)
  const moveBlock = useTripStore((s) => s.moveBlock)
  const setEvidence = useTripStore((s) => s.setEvidence)
  const addDay = useTripStore((s) => s.addDay)
  const removeDay = useTripStore((s) => s.removeDay)
  const clearDayArrangements = useTripStore((s) => s.clearDayArrangements)

  const locale = useSettings((s) => s.locale)
  const llm = useSettings((s) => s.llm)

  const [editing, setEditing] = useState<{ dayId: string; block: Block } | null>(null)
  const [disruption, setDisruption] = useState<{ open: boolean; dayId?: string }>({ open: false })
  const [validating, setValidating] = useState(false)
  const [validateError, setValidateError] = useState<string | null>(null)
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ containerId: string; index: number } | null>(null)
  const [pendingDayAction, setPendingDayAction] = useState<{
    type: 'remove' | 'clear'
    dayId: string
    index: number
    blockCount: number
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Map every block id to its container id (Day.id or UNSCHEDULED_ID).
  const blockToContainer = useMemo(() => {
    const map = new Map<string, string>()
    trip?.days.forEach((d) => d.blocks.forEach((b) => map.set(b.id, d.id)))
    trip?.unscheduled.forEach((b) => map.set(b.id, UNSCHEDULED_ID))
    return map
  }, [trip])

  const blockById = useMemo(() => {
    const map = new Map<string, Block>()
    trip?.days.forEach((d) => d.blocks.forEach((b) => map.set(b.id, b)))
    trip?.unscheduled.forEach((b) => map.set(b.id, b))
    return map
  }, [trip])

  const collisionDetectionStrategy = useMemo<CollisionDetection>(() => {
    const containerIds = new Set([UNSCHEDULED_ID, ...(trip?.days.map((d) => d.id) ?? [])])
    return (args) => {
      const pointerHits = pointerWithin(args)
      if (pointerHits.length > 0) {
        const sortableHit = pointerHits.find((hit) =>
          blockToContainer.has(String(hit.id)),
        )
        if (sortableHit) return [sortableHit]

        const containerHit = pointerHits.find((hit) =>
          containerIds.has(String(hit.id)),
        )
        if (containerHit) return [containerHit]

        return pointerHits
      }

      const intersections = rectIntersection(args)
      if (intersections.length > 0) return intersections

      return closestCorners(args)
    }
  }, [blockToContainer, trip])

  const containerBlocks = (id: string): Block[] => {
    if (!trip) return []
    if (id === UNSCHEDULED_ID) return trip.unscheduled
    return trip.days.find((d) => d.id === id)?.blocks ?? []
  }

  const resolveDropTarget = (overId: string) => {
    const containerId = blockToContainer.get(overId) ?? overId
    const blocks = containerBlocks(containerId)
    const overIdx = blocks.findIndex((b) => b.id === overId)
    return {
      containerId,
      index: overIdx >= 0 ? overIdx : blocks.length,
    }
  }

  const fallbackDropTarget = useMemo(() => {
    if (!activeBlockId) return null
    const containerId = blockToContainer.get(activeBlockId)
    if (!containerId) return null
    const index = containerBlocks(containerId).findIndex((b) => b.id === activeBlockId)
    return { containerId, index: Math.max(0, index) }
  }, [activeBlockId, blockToContainer, trip])

  const visibleDropTarget = dropTarget ?? fallbackDropTarget

  if (!trip) {
    return <EmptyStateView />
  }

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveBlockId(id)
    const containerId = blockToContainer.get(id)
    if (containerId) {
      const index = containerBlocks(containerId).findIndex((b) => b.id === id)
      setDropTarget({ containerId, index: Math.max(0, index) })
    }
  }

  const handleDragOver = (e: DragOverEvent) => {
    if (!e.over) {
      // Keep the last valid target visible instead of falling back to only a
      // gray source card while the pointer briefly crosses gaps.
      return
    }
    setDropTarget(resolveDropTarget(String(e.over.id)))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const finalTarget = over
      ? resolveDropTarget(String(over.id))
      : dropTarget ?? fallbackDropTarget
    setActiveBlockId(null)
    setDropTarget(null)
    if (!finalTarget) return
    const fromContainer = blockToContainer.get(String(active.id))
    if (!fromContainer) return

    moveBlock(fromContainer, String(active.id), finalTarget.containerId, finalTarget.index)
  }

  const clearDragState = () => {
    setActiveBlockId(null)
    setDropTarget(null)
  }

  const firstDate = trip.days.find((d) => d.date)?.date
  const lastDate = [...trip.days].reverse().find((d) => d.date)?.date
  const dateRange =
    firstDate && lastDate
      ? `${shortDateLabel(firstDate, locale)} - ${shortDateLabel(lastDate, locale)}`
      : t(locale, 'daysSummary')(trip.days.length)
  const destinationTitle = trip.meta.countries.join(', ')
  const tripTitle = destinationTitle
    ? `${destinationTitle} · ${dateRange}`
    : trip.meta.title || (locale === 'zh' ? `未命名行程 · ${dateRange}` : `Untitled trip · ${dateRange}`)
  const scheduledCount = trip.days.flatMap((d) => d.blocks).length

  const confirmDayAction = () => {
    if (!pendingDayAction) return
    if (pendingDayAction.type === 'remove') removeDay(pendingDayAction.dayId)
    else clearDayArrangements(pendingDayAction.dayId)
    onSelectBlock(null)
    setPendingDayAction(null)
  }

  const runValidate = async () => {
    if (!llm.apiKey) {
      setValidateError(t(locale, 'fillKeyFirst'))
      return
    }
    setValidating(true)
    setValidateError(null)
    try {
      const out = await validateTrip(trip, llm, locale)
      const checkedAt = new Date().toISOString()
      for (const d of trip.days) {
        for (const b of d.blocks) {
          const e = out.byBlockId[b.id]
          if (e) setEvidence(d.id, b.id, { ...b.evidence, ...e, checkedAt })
        }
      }
      for (const b of trip.unscheduled) {
        const e = out.byBlockId[b.id]
        if (e) setEvidence(UNSCHEDULED_ID, b.id, { ...b.evidence, ...e, checkedAt })
      }
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : String(err))
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100svh-128px)] flex-col">
      {validateError && (
        <ErrorState className="mb-3" message={validateError} />
      )}
      {validating && (
        <LoadingState
          className="mb-3"
          title={t(locale, 'validating')}
          description={t(locale, 'validateHint')}
        />
      )}

      <PageHeader
        className="mb-3"
        title={tripTitle}
        description={
          trip.meta.countries.length > 0
            ? `${t(locale, 'countriesPrefix')}${trip.meta.countries.join(', ')}`
            : dateRange
        }
        meta={
          <>
            <span className="chip-brand">{dateRange}</span>
            <span className="chip-gray">
              {scheduledCount} {locale === 'zh' ? '项活动' : 'scheduled'}
            </span>
            <span className="chip-gray">
              {trip.unscheduled.length} {locale === 'zh' ? '个候选' : 'candidates'}
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={runValidate}
              disabled={validating}
              title={t(locale, 'validateHint')}
            >
              {validating ? t(locale, 'validating') : t(locale, 'validateAll')}
            </Button>
            <Button
              variant="primary"
              onClick={() => setDisruption({ open: true })}
              title={t(locale, 'replanHint')}
            >
              {t(locale, 'replan')}
            </Button>
            <Button variant="quiet" onClick={addDay}>
              + {t(locale, 'addDay')}
            </Button>
          </>
        }
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={clearDragState}
      >
        <CandidatesStrip
          selectedBlockId={selectedBlockId}
          onSelect={onSelectBlock}
          onEdit={(b: Block) => setEditing({ dayId: UNSCHEDULED_ID, block: b })}
          dropIndex={visibleDropTarget?.containerId === UNSCHEDULED_ID ? visibleDropTarget.index : null}
          activeBlockId={activeBlockId}
        />
        <div className="kanban-scroll -mx-2 grid flex-1 grid-flow-col auto-cols-[minmax(240px,85vw)] gap-3 overflow-x-auto px-2 pb-4 pt-1 sm:auto-cols-[minmax(272px,1fr)] sm:gap-4">
          {trip.days.map((day) => (
            <DayColumn
              key={day.id}
              day={day}
              selectedBlockId={selectedBlockId}
              onSelect={onSelectBlock}
              onEdit={(b: Block) => setEditing({ dayId: day.id, block: b })}
              onReplanDay={() => setDisruption({ open: true, dayId: day.id })}
              onClearDay={() =>
                setPendingDayAction({
                  type: 'clear',
                  dayId: day.id,
                  index: day.index,
                  blockCount: day.blocks.length,
                })
              }
              onRemoveDay={() =>
                setPendingDayAction({
                  type: 'remove',
                  dayId: day.id,
                  index: day.index,
                  blockCount: day.blocks.length,
                })
              }
              dropIndex={visibleDropTarget?.containerId === day.id ? visibleDropTarget.index : null}
              activeBlockId={activeBlockId}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeBlockId ? (
            <DragGhostCard block={blockById.get(activeBlockId)} locale={locale} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <StatusBar onReview={() => onSwitchTab('review')} />

      {editing && (
        <BlockEditor
          dayId={editing.dayId}
          block={editing.block}
          onClose={() => setEditing(null)}
        />
      )}

      <DisruptionDialog
        open={disruption.open}
        dayId={disruption.dayId}
        onClose={() => setDisruption({ open: false })}
      />

      {pendingDayAction && (
        <Modal
          title={
            pendingDayAction.type === 'remove'
              ? t(locale, 'confirmRemoveDayTitle')(pendingDayAction.index)
              : t(locale, 'confirmClearDayTitle')(pendingDayAction.index)
          }
          onClose={() => setPendingDayAction(null)}
          maxWidthClassName="max-w-md"
          bodyClassName="space-y-4"
          footer={
            <>
              <Button variant="outline" onClick={() => setPendingDayAction(null)}>
                {locale === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button variant="danger" onClick={confirmDayAction}>
                {pendingDayAction.type === 'remove'
                  ? t(locale, 'removeDay')
                  : t(locale, 'clearDay')}
              </Button>
            </>
          }
        >
          <div className="rounded-2xl border border-red-100 bg-red-50/55 px-4 py-3">
            <div className="text-sm font-semibold text-ink-900">
              {t(locale, 'dayBadge')(pendingDayAction.index)}
              {' · '}
              {pendingDayAction.blockCount} {locale === 'zh' ? '项活动' : 'items'}
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-600">
              {pendingDayAction.type === 'remove'
                ? t(locale, 'confirmRemoveDayBody')
                : t(locale, 'confirmClearDayBody')}
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DragGhostCard({ block, locale }: { block?: Block; locale: 'zh' | 'en' }) {
  if (!block) return null
  return (
    <div className="w-[260px] rotate-[0.5deg] rounded-[var(--fi-radius)] border border-white/80 bg-white/70 p-3.5 text-ink-700 opacity-90 shadow-pop backdrop-blur-2xl grayscale">
      <div className="mb-2 flex items-center justify-between text-caption text-ink-500">
        <span>{block.granularity === 'flexible' ? (locale === 'zh' ? '移动中' : 'Dragging') : block.startTime ?? ''}</span>
        <span>{fmtDuration(block.durationMin, locale)}</span>
      </div>
      <div className="truncate text-sm font-semibold text-ink-900">
        {block.title || (locale === 'zh' ? '未命名' : 'Untitled')}
      </div>
      {block.place?.name && block.place.name !== block.title && (
        <div className="mt-1 truncate text-caption text-ink-600">{block.place.name}</div>
      )}
      <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-brand-300/60 via-accent-300/60 to-transparent" />
    </div>
  )
}

function EmptyStateView() {
  const locale = useSettings((s) => s.locale)
  return (
    <BlankState
      className="min-h-[60vh]"
      icon={<BrandMark label="✦" size="lg" />}
      title={t(locale, 'emptyTitle')}
      description={t(locale, 'emptyHint')}
    />
  )
}
