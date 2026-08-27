import { lazy, Suspense, useEffect, useState } from 'react'
import { AccessProblem, AuthScreen, ConfigurationRequired, LoadingScreen } from './components/AccessScreens'
import AppShell from './components/AppShell'
import { useWorkspace } from './context/WorkspaceContext'

const DashboardView = lazy(() => import('./features/DashboardView'))
const ExportsView = lazy(() => import('./features/ExportsView'))
const MatchingView = lazy(() => import('./features/MatchingView'))
const ScenariosView = lazy(() => import('./features/ScenariosView'))
const SettingsView = lazy(() => import('./features/SettingsView'))
const StudentsView = lazy(() => import('./features/StudentsView'))

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
  return <AppShell current={view} onNavigate={navigate}><Suspense fallback={<div className="view-loader"><span className="loader" /><p>Ouverture…</p></div>}>{content}</Suspense></AppShell>
}
