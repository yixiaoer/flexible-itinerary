import type { Locale } from '../types'
import { t } from '../i18n/messages'
import type { Tab } from '../App'
import { BrandMark, Button, SegmentedControl, type SegmentedOption } from './ui'

interface Props {
  locale: Locale
  onOpenLibrary: () => void
  onOpenSettings: () => void
  onClearTrip: () => void
  hasTrip: boolean
  tab: Tab
  onTab: (t: Tab) => void
}

export function Header({ locale, onOpenLibrary, onOpenSettings, onClearTrip, hasTrip, tab, onTab }: Props) {
  const tabs: Array<SegmentedOption<Tab>> = [
    { value: 'board', label: t(locale, 'tabBoard') },
    { value: 'map', label: t(locale, 'tabMap'), disabled: !hasTrip },
    { value: 'review', label: t(locale, 'tabReview'), disabled: !hasTrip },
  ]

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/45 shadow-sm shadow-ink-900/[0.03] backdrop-blur-2xl">
      <div className="app-container flex flex-wrap items-center gap-4 py-4 lg:flex-nowrap">
        {/* Left: brand */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:max-w-[300px]">
          <BrandMark />
          <div className="truncate text-xl font-semibold tracking-[-0.055em] text-ink-900">
            {t(locale, 'appTitle')}
          </div>
        </div>

        {/* Center: tabs */}
        <nav className="order-3 w-full overflow-x-auto lg:order-none lg:flex lg:flex-1 lg:justify-center">
          <SegmentedControl options={tabs} value={tab} onChange={onTab} itemClassName="whitespace-nowrap" />
        </nav>

        {/* Right: actions */}
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2 lg:w-[300px]">
          <Button
            variant="quiet"
            className="text-ink-500 hover:text-brand-700"
            onClick={onOpenLibrary}
            title={locale === 'zh' ? '我的行程' : 'My Trips'}
          >
            <span className="hidden sm:inline">{locale === 'zh' ? '我的行程' : 'Trips'}</span>
            <span className="sm:hidden">{locale === 'zh' ? '行程' : 'Trips'}</span>
          </Button>
          {hasTrip && (
            <Button
              variant="quiet"
              className="text-ink-500 hover:text-red-700"
              onClick={onClearTrip}
              title={t(locale, 'deleteTrip')}
            >
              <span className="hidden sm:inline">{t(locale, 'deleteTrip')}</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          )}
          <Button
            variant="quiet"
            className="h-8 w-8 p-0"
            onClick={onOpenSettings}
            aria-label={t(locale, 'settings')}
            title={t(locale, 'settings')}
          >
            <GearGlyph />
          </Button>
        </div>
      </div>
    </header>
  )
}

function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
