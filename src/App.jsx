import { Suspense, useEffect, useState } from 'react'
import { AccessProblem, AuthScreen, ConfigurationRequired, LoadingScreen } from './components/AccessScreens'
import AppShell from './components/AppShell'
import ViewLoadBoundary from './components/ViewLoadBoundary'
import { useWorkspace } from './context/WorkspaceContext'
import { lazyView } from './lib/lazyView'

const DashboardView = lazyView('dashboard', () => import('./features/DashboardView'))
const ExportsView = lazyView('exports', () => import('./features/ExportsView'))
const MatchingView = lazyView('matching', () => import('./features/MatchingView'))
const ScenariosView = lazyView('scenarios', () => import('./features/ScenariosView'))
const SettingsView = lazyView('settings', () => import('./features/SettingsView'))
const StudentsView = lazyView('students', () => import('./features/StudentsView'))

const validViews = new Set(['dashboard', 'students', 'matching', 'scenarios', 'exports', 'settings'])
const readHash = () => {
  const value = window.location.hash.replace('#/', '')
  return validViews.has(value) ? value : 'dashboard'
}

export default function App() {
  const { loading, accessState, workspace } = useWorkspace()
  const [view, setView] = useState(readHash)
  useEffect(() => {
    const onHash = () => setView(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (next) => { window.location.hash = `/${next}`; setView(next) }
  if (loading || accessState === 'loading') return <LoadingScreen />
  if (accessState === 'configuration') return <ConfigurationRequired />
  if (accessState === 'auth') return <AuthScreen />
  if (accessState === 'unauthorized') return <AccessProblem unauthorized />
  if (accessState === 'error') return <AccessProblem />
  if (!workspace) return <LoadingScreen />
  const content = {
    dashboard: <DashboardView onNavigate={navigate} />,
    students: <StudentsView />,
    matching: <MatchingView />,
    scenarios: <ScenariosView onNavigate={navigate} />,
    exports: <ExportsView />,
    settings: <SettingsView />,
  }[view]
  return <AppShell current={view} onNavigate={navigate}><ViewLoadBoundary key={view}><Suspense fallback={<div className="view-loader"><span className="loader" /><p>Ouverture…</p></div>}>{content}</Suspense></ViewLoadBoundary></AppShell>
}
