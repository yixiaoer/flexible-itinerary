import { useState } from 'react'
import { Header } from './components/Header'
import { SettingsDrawer } from './components/SettingsDrawer'
import { TripLibraryDrawer } from './components/TripLibraryDrawer'
import { TripSidebar } from './components/TripSidebar'
import { BoardView } from './components/BoardView'
import { MapPanel } from './components/MapPanel'
import { ReviewView } from './components/ReviewView'
import { RightPanel } from './components/RightPanel'
import { Drawer } from './components/ui'
import { AppShell } from './components/layout'
import { useTripStore } from './store/trip'
import { useSettings } from './store/settings'
import { t } from './i18n/messages'

export type Tab = 'board' | 'map' | 'review'

export default function App() {
  const trip = useTripStore((s) => s.trip)
  const reset = useTripStore((s) => s.reset)
  const locale = useSettings((s) => s.locale)
  const [tab, setTab] = useState<Tab>('board')
  const [showSettings, setShowSettings] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const showRight = tab === 'board' && !!trip

  const header = (
    <Header
      locale={locale}
      onOpenLibrary={() => setShowLibrary(true)}
      onOpenSettings={() => setShowSettings(true)}
      onClearTrip={() => {
        if (confirm(t(locale, 'confirmDeleteTrip'))) {
          reset()
          setSelectedBlockId(null)
        }
      }}
      hasTrip={!!trip}
      tab={tab}
      onTab={setTab}
    />
  )

  const main = (
    <>
      {tab === 'board' && (
        <BoardView
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onSwitchTab={setTab}
        />
      )}
      {tab === 'map' && <MapPanel />}
      {tab === 'review' && <ReviewView onSwitchTab={setTab} />}
    </>
  )

  const overlays = (
    <>
      <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
      <TripLibraryDrawer
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onTripOpened={() => {
          setSelectedBlockId(null)
          setTab('board')
        }}
      />
      {showRight && selectedBlockId && (
        <div className="2xl:hidden">
          <Drawer
            open
            side="bottom"
            title={t(locale, 'selectedTitle')}
            onClose={() => setSelectedBlockId(null)}
            className="max-h-[88vh]"
          >
            <RightPanel selectedBlockId={selectedBlockId} />
          </Drawer>
        </div>
      )}
    </>
  )

  return (
    <AppShell
      header={header}
      sidebar={<TripSidebar key={trip?.id ?? 'empty-trip'} onGenerated={() => setTab('board')} />}
      main={main}
      aside={showRight ? <RightPanel selectedBlockId={selectedBlockId} /> : undefined}
      overlays={overlays}
    />
  )
}
