import { useState } from 'react'
import { Header } from './components/Header'
import { SettingsDrawer } from './components/SettingsDrawer'
import { TripLibraryDrawer } from './components/TripLibraryDrawer'
import { TripSidebar } from './components/TripSidebar'
import { BoardView } from './components/BoardView'
import { MapPanel } from './components/MapPanel'
import { ReviewView } from './components/ReviewView'
import { RightPanel } from './components/RightPanel'
import { Button, Drawer, Modal } from './components/ui'
import { AppShell } from './components/layout'
import { useTripStore } from './store/trip'
import { useSettings } from './store/settings'
import { t } from './i18n/messages'

export type Tab = 'board' | 'map' | 'review'

export default function App() {
  const trip = useTripStore((s) => s.trip)
  const createBlankTrip = useTripStore((s) => s.createBlankTrip)
  const clearArrangements = useTripStore((s) => s.clearArrangements)
  const locale = useSettings((s) => s.locale)
  const [tab, setTab] = useState<Tab>('board')
  const [showSettings, setShowSettings] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [pendingAction, setPendingAction] = useState<'newTrip' | 'clearArrangements' | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const activeTripTitle =
    trip?.meta.title || trip?.meta.countries.join(', ') || (locale === 'zh' ? '未命名行程' : 'Untitled trip')
  const confirmTitle =
    pendingAction === 'newTrip'
      ? t(locale, 'confirmNewTripTitle')
      : t(locale, 'confirmClearArrangementsTitle')
  const confirmBody =
    pendingAction === 'newTrip'
      ? t(locale, 'confirmNewTripBody')
      : t(locale, 'confirmClearArrangementsBody')
  const confirmButton =
    pendingAction === 'newTrip'
      ? t(locale, 'newTripAction')
      : t(locale, 'clearArrangements')

  const confirmHeaderAction = () => {
    if (pendingAction === 'newTrip') {
      createBlankTrip()
      setTab('board')
    } else if (pendingAction === 'clearArrangements') {
      clearArrangements()
    }
    setSelectedBlockId(null)
    setPendingAction(null)
  }

  const header = (
    <Header
      locale={locale}
      onOpenLibrary={() => setShowLibrary(true)}
      onOpenSettings={() => setShowSettings(true)}
      onOpenSidebar={() => setShowMobileSidebar(true)}
      onNewTrip={() => {
        if (trip) setPendingAction('newTrip')
        else createBlankTrip()
      }}
      onClearArrangements={() => setPendingAction('clearArrangements')}
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
      <div className="lg:hidden">
        <Drawer
          open={showMobileSidebar}
          side="right"
          title={t(locale, 'sidebarTitle')}
          onClose={() => setShowMobileSidebar(false)}
        >
          <TripSidebar key={trip?.id ?? 'empty-trip-mobile'} onGenerated={() => {
            setTab('board')
            setShowMobileSidebar(false)
          }} />
        </Drawer>
      </div>
      {tab === 'board' && trip && selectedBlockId && (
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
      {pendingAction && (
        <Modal
          title={confirmTitle}
          onClose={() => setPendingAction(null)}
          maxWidthClassName="max-w-md"
          bodyClassName="space-y-4"
          footer={
            <>
              <Button variant="outline" onClick={() => setPendingAction(null)}>
                {locale === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button
                variant={pendingAction === 'newTrip' ? 'primary' : 'danger'}
                onClick={confirmHeaderAction}
              >
                {confirmButton}
              </Button>
            </>
          }
        >
          <div className="rounded-2xl border border-red-100 bg-red-50/55 px-4 py-3">
            <div className="text-sm font-semibold text-ink-900">{activeTripTitle}</div>
            <p className="mt-1 text-sm leading-6 text-ink-600">{confirmBody}</p>
          </div>
        </Modal>
      )}
    </>
  )

  return (
    <AppShell
      header={header}
      sidebar={<TripSidebar key={trip?.id ?? 'empty-trip'} onGenerated={() => setTab('board')} />}
      main={main}
      overlays={overlays}
    />
  )
}
