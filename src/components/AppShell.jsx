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
import { previewMode } from '../lib/storage'

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
  return <span className={`sync-indicator ${error ? 'is-error' : ''}`} title={syncMessage || text} role="status"><Icon size={16} aria-hidden="true" /> {text}</span>
}

export default function AppShell({ current, onNavigate, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { workspace, user, cloudEnabled, canUndo, canRedo, undo, redo, signOut } = useWorkspace()
  const userLabel = accountLabel(user?.email)
  const navigate = (id) => { onNavigate(id); setMobileOpen(false) }
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen} aria-controls="main-sidebar">
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <Brand />
        <div className="topbar-center">
          <span className="workspace-title">{workspace.meta.title}</span>
          <SyncIndicator />
        </div>
        <div className="topbar-actions">
          <button className="icon-button" disabled={!canUndo} onClick={undo} title="Annuler" aria-label="Annuler"><Undo2 /></button>
          <button className="icon-button" disabled={!canRedo} onClick={redo} title="Rétablir" aria-label="Rétablir"><Redo2 /></button>
          <span className="avatar" title={userLabel}>{cloudEnabled ? userLabel.replace('Responsable ', 'R') : 'D'}</span>
        </div>
      </header>

      <aside id="main-sidebar" className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <nav aria-label="Navigation principale">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={current === id ? 'active' : ''} aria-current={current === id ? 'page' : undefined} aria-label={label} title={label} onClick={() => navigate(id)}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>{cloudEnabled ? 'Espace partagé privé' : 'Mode démonstration local'}</p>
          {cloudEnabled && <button onClick={signOut} aria-label="Déconnexion" title="Déconnexion"><LogOut size={17} aria-hidden="true" /> <span>Déconnexion</span></button>}
        </div>
      </aside>

      <main className="main-content">
        {previewMode && <p className="preview-banner"><strong>Version de test</strong> Les données de démonstration restent dans ce navigateur.</p>}
        {children}
      </main>
      {mobileOpen && <button className="menu-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />}
    </div>
  )
}
