import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { DataProvider, useData, wasSignedIn } from './data/DataProvider'
import ComingSoon from './pages/ComingSoon'
import GearPage from './pages/GearPage'
import ProfilePage from './pages/ProfilePage'
import SwimmersPage from './pages/SwimmersPage'

const TABS = [
  { to: '/gear', label: 'Gear', icon: '🎒' },
  { to: '/competitions', label: 'Meets', icon: '🏁' },
  { to: '/swimmers', label: 'Swimmers', icon: '🏊' },
  { to: '/workouts', label: 'Workouts', icon: '📋' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <div className="md:flex">
          <nav className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-slate-200 md:bg-white md:p-4">
            <div className="mb-6 px-3 text-xl font-bold text-brand-700">FlipTurn</div>
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`
                }
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <main className="min-w-0 flex-1 pb-24 md:pb-8">
            <SyncBanner />
            <Routes>
              <Route path="/gear" element={<GearPage />} />
              <Route
                path="/competitions"
                element={
                  <ComingSoon title="Competitions" phase={3}>
                    Create meets, upload the event list, and build relays and individual entries from your active swimmers.
                  </ComingSoon>
                }
              />
              <Route path="/swimmers" element={<SwimmersPage />} />
              <Route
                path="/workouts"
                element={
                  <ComingSoon title="Workouts" phase={4}>
                    Build workouts from saved warm ups, sets and cool downs, with sets tagged automatically.
                  </ComingSoon>
                }
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/gear" replace />} />
            </Routes>
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-1 flex-col items-center justify-center text-xs font-medium ${isActive ? 'text-brand-700' : 'text-slate-500'}`
                }
              >
                <span aria-hidden className="text-lg leading-none">{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </HashRouter>
    </DataProvider>
  )
}

function SyncBanner() {
  const { status, error, signIn } = useData()
  if (status === 'synced' || status === 'syncing' || status === 'local-only') return null
  if (status === 'error') {
    return <div className="bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-8">{error}</div>
  }
  return (
    <div className="flex items-center justify-between gap-3 bg-brand-50 px-4 py-2 text-sm text-brand-900 md:px-8">
      <span>
        {error ?? (wasSignedIn() ? 'Reconnect to Google Drive to sync changes.' : 'Changes are saved on this device. Sign in to save to Google Drive.')}
      </span>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={status === 'connecting'}
        className="min-h-10 shrink-0 rounded-lg bg-brand-700 px-3 font-semibold text-white disabled:bg-slate-400"
      >
        {status === 'connecting' ? 'Connecting…' : wasSignedIn() ? 'Reconnect' : 'Sign in'}
      </button>
    </div>
  )
}
