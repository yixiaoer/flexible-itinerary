import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block } from '../types'
import { UNSCHEDULED_ID } from '../types'
import { useTripStore } from '../store/trip'
import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import { fmtDuration } from '../lib/time'
import { makeEmptyBlock, suggestCandidates } from '../lib/planner'
import { Button, ErrorState, CountBadge, PanelHeader, SelectableCard } from './ui'

interface Props {
  selectedBlockId: string | null
  onSelect: (id: string | null) => void
  onEdit: (b: Block) => void
  dropIndex?: number | null
  activeBlockId?: string | null
}

export function CandidatesStrip({ selectedBlockId, onSelect, onEdit, dropIndex, activeBlockId }: Props) {
  const trip = useTripStore((s) => s.trip)
  const addBlock = useTripStore((s) => s.addBlock)
  const appendUnscheduled = useTripStore((s) => s.appendUnscheduled)
  const locale = useSettings((s) => s.locale)
  const llm = useSettings((s) => s.llm)
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED_ID })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = trip?.unscheduled ?? []

  const aiSuggest = async () => {
    if (!trip) return
    if (!llm.apiKey) {
      setError(t(locale, 'fillKeyFirst'))
      return
    }
    setError(null)
    setBusy(true)
    try {
      const blocks = await suggestCandidates(trip, llm, locale)
      appendUnscheduled(blocks)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`surface-glass mb-4 overflow-hidden transition ${
        isOver ? 'ring-2 ring-brand-200' : ''
      }`}
    >
      <PanelHeader
        icon={<span className="h-2 w-2 rounded-full bg-brand-500" />}
        title={t(locale, 'candidatesTitle')}
        meta={<CountBadge>{list.length}</CountBadge>}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addBlock(UNSCHEDULED_ID, makeEmptyBlock())}
            >
              {t(locale, 'addCandidate')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={aiSuggest}
              disabled={busy}
              title={t(locale, 'aiSuggestMore')}
            >
              {busy ? t(locale, 'aiSuggesting') : t(locale, 'aiSuggestMore')}
            </Button>
          </>
        }
      />

      {error && (
        <ErrorState message={error} className="mx-4 mt-3 text-xs" />
      )}

      <SortableContext items={list.map((b) => b.id)} strategy={horizontalListSortingStrategy}>
        {list.length === 0 ? (
          <div className="px-4 py-5 text-center">
            {dropIndex === 0 && (
              <div className="mx-auto mb-3 h-3 max-w-md rounded-full bg-brand-50/25">
                <div className="mx-auto h-px max-w-[80%] translate-y-1.5 rounded-full bg-gradient-to-r from-brand-400/45 via-accent-400/35 to-transparent" />
              </div>
            )}
            <div className="text-sm font-medium text-ink-500">{t(locale, 'candidatesEmpty')}</div>
          </div>
        ) : (
          <div className="kanban-scroll flex gap-3 overflow-x-auto px-4 py-4">
            {list.map((b, index) => (
              <div key={b.id} className="flex shrink-0 items-stretch gap-3">
                {dropIndex === index && <HorizontalDropIndicator />}
                <CandidateCard
                  block={b}
                  selected={selectedBlockId === b.id}
                  onSelect={() => onSelect(b.id)}
                  onEdit={() => onEdit(b)}
                  dragging={activeBlockId === b.id}
                />
              </div>
            ))}
            {dropIndex === list.length && <HorizontalDropIndicator />}
          </div>
        )}
      </SortableContext>
    </div>
  )
}

interface CardProps {
  block: Block
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  dragging?: boolean
}

function CandidateCard({ block, selected, onSelect, onEdit, dragging = false }: CardProps) {
  const removeBlock = useTripStore((s) => s.removeBlock)
  const locale = useSettings((s) => s.locale)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const dpLabel =
    block.daypart === 'ANY'
      ? t(locale, 'daypartFlexible')
      : block.daypart === 'AM'
        ? t(locale, 'morning')
        : block.daypart === 'PM'
          ? t(locale, 'afternoon')
          : block.daypart === 'EVE'
            ? t(locale, 'evening')
            : ''

  return (
    <SelectableCard
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      selected={selected}
      className={`group relative flex w-[220px] shrink-0 flex-col gap-1 bg-white/90 px-3.5 py-3 shadow-sm hover:-translate-y-0.5 hover:shadow-card ${
        dragging ? 'grayscale ring-1 ring-brand-200/70' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="truncate text-sm font-medium text-ink-900">
        {block.title || (locale === 'zh' ? '未命名' : 'Untitled')}
      </div>
      {block.place?.name && block.place.name !== block.title && (
        <div className="truncate text-caption text-ink-500">{block.place.name}</div>
      )}
      <div className="mt-0.5 flex items-center gap-1 text-caption text-ink-400">
        {dpLabel && <span>{dpLabel}</span>}
        {dpLabel && <span>·</span>}
        <span>{fmtDuration(block.durationMin, locale)}</span>
      </div>

      <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        <button
          className="icon-btn h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          title={t(locale, 'edit')}
          aria-label={t(locale, 'edit')}
        >
          ✎
        </button>
        <button
          className="icon-btn h-6 w-6 hover:bg-red-50 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            removeBlock(UNSCHEDULED_ID, block.id)
          }}
          title={t(locale, 'delete')}
          aria-label={t(locale, 'delete')}
        >
          ✕
        </button>
      </div>
    </SelectableCard>
  )
}

function HorizontalDropIndicator() {
  return (
    <div className="relative my-2 w-3 shrink-0 rounded-full bg-brand-50/25">
      <div className="absolute bottom-4 top-4 left-1/2 w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-400/45 via-accent-400/35 to-transparent" />
    </div>
  )
}
