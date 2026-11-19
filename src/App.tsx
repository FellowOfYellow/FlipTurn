import { HashRouter, Link, MemoryRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { DataProvider, useData, wasSignedIn } from './data/DataProvider'
import ComingSoon from './pages/ComingSoon'
import CompetitionDetail from './pages/competitions/CompetitionDetail'
import CompetitionEditor from './pages/competitions/CompetitionEditor'
import CompetitionsPage from './pages/competitions/CompetitionsPage'
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

// Preview builds run inside a host page that owns the URL, so keep routes in memory.
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : HashRouter

export default function App() {
  return (
    <DataProvider>
      <Router initialEntries={['/gear']}>
        <div className="wide:flex">
          <nav className="hidden wide:sticky wide:top-0 wide:flex wide:h-dvh wide:w-56 wide:shrink-0 wide:flex-col wide:border-r wide:border-slate-200 wide:bg-white wide:p-4 wide:pt-[max(1rem,env(safe-area-inset-top))]">
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
          <main className="min-w-0 flex-1 pt-[env(safe-area-inset-top)] pb-24 wide:pb-8">
            <SyncBanner />
            <Routes>
              <Route path="/gear" element={<GearPage />} />
              <Route path="/competitions" element={<CompetitionsPage />} />
              <Route path="/competitions/new" element={<CompetitionEditor />} />
              <Route path="/competitions/:id" element={<CompetitionDetail />} />
              <Route path="/competitions/:id/edit" element={<CompetitionEditor key="edit" />} />
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
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur wide:hidden">
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
      </Router>
    </DataProvider>
  )
}

function SyncBanner() {
  const { status, error, signIn } = useData()
  if (status === 'synced' || status === 'syncing' || status === 'local-only') return null
  if (status === 'choose-team') {
    return (
      <div className="flex items-center justify-between gap-3 bg-brand-50 px-4 py-2 text-sm text-brand-900 md:px-8">
        <span>Finish setting up Google Drive: start a new team or join one.</span>
        <Link to="/profile" className="flex min-h-10 shrink-0 items-center rounded-lg bg-brand-700 px-3 font-semibold text-white">
          Finish setup
        </Link>
      </div>
    )
  }
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
