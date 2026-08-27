import {
  ArrowLeftRight,
  ClipboardList,
  Download,
  LogOut,
  Menu,
  Redo2,
  Settings,
  Undo2,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { accountLabel } from '../lib/accounts'

const navItems = [
  { id: 'students', label: 'Inscriptions', icon: ClipboardList },
  { id: 'matching', label: 'Appairages', icon: ArrowLeftRight },
  { id: 'scenarios', label: 'Scénarios', icon: UsersRound },
  { id: 'exports', label: 'Exports', icon: Download },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

export function Brand() {
  return (
    <div className="brand" aria-label="Rotations Bercher–Brugg">
      <span className="brand-mark"><b>B</b><b>B</b></span>
      <span><strong>Rotations Bercher–Brugg</strong><small>Échanges linguistiques</small></span>
    </div>
  )
}

const SyncIndicator = () => {
  const { syncState, syncMessage, cloudEnabled } = useWorkspace()
  const error = ['error', 'conflict'].includes(syncState)
  const text = syncState === 'saving' ? 'Enregistrement…'
    : syncState === 'dirty' ? 'Modifications en attente'
      : syncState === 'conflict' ? 'Conflit de version'
        : syncState === 'error' ? 'Erreur de sauvegarde'
          : cloudEnabled ? 'À jour' : 'Enregistré sur cet appareil'
  const Icon = error ? WifiOff : Wifi
  return <span className={`sync-indicator ${error ? 'is-error' : ''}`} title={syncMessage || text}><Icon size={16} /> {text}</span>
}

export default function AppShell({ current, onNavigate, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { workspace, user, cloudEnabled, canUndo, canRedo, undo, redo, signOut } = useWorkspace()
  const userLabel = accountLabel(user?.email)
  const navigate = (id) => { onNavigate(id); setMobileOpen(false) }
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileOpen((value) => !value)} aria-label="Ouvrir le menu">
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <Brand />
        <div className="topbar-center">
          <button className="workspace-switcher" onClick={() => navigate('settings')}>{workspace.meta.title}</button>
          <SyncIndicator />
        </div>
        <div className="topbar-actions">
          <button className="icon-button" disabled={!canUndo} onClick={undo} title="Annuler"><Undo2 /></button>
          <button className="icon-button" disabled={!canRedo} onClick={redo} title="Rétablir"><Redo2 /></button>
          <span className="avatar" title={userLabel}>{cloudEnabled ? userLabel.replace('Responsable ', 'R') : 'D'}</span>
        </div>
      </header>

      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <nav aria-label="Navigation principale">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={current === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>{cloudEnabled ? 'Espace partagé privé' : 'Mode démonstration local'}</p>
          {cloudEnabled && <button onClick={signOut}><LogOut size={17} /> Déconnexion</button>}
        </div>
      </aside>

      <main className="main-content">{children}</main>
      {mobileOpen && <button className="menu-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />}
    </div>
  )
}
