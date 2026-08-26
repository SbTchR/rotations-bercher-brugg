import { Cloud, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export default function SettingsView() {
  const { workspace, actions, cloudEnabled, user, reload, syncMessage } = useWorkspace()
  const [draft, setDraft] = useState(workspace.meta)
  const save = (event) => { event.preventDefault(); actions.updateMeta(draft) }
  return (
    <div className="view settings-view">
      <div className="view-heading"><div><h1>Paramètres</h1><p>Dates, titre de l’année et état de la synchronisation.</p></div></div>
      <div className="settings-grid">
        <form className="settings-panel" onSubmit={save}>
          <h2>Échange en cours</h2>
          <label>Titre<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Année scolaire<input value={draft.schoolYear} onChange={(event) => setDraft((current) => ({ ...current, schoolYear: event.target.value }))} /></label>
          <label>Rotation A<textarea rows="3" value={draft.groupA} onChange={(event) => setDraft((current) => ({ ...current, groupA: event.target.value }))} /></label>
          <label>Rotation B<textarea rows="3" value={draft.groupB} onChange={(event) => setDraft((current) => ({ ...current, groupB: event.target.value }))} /></label>
          <button className="primary-button">Enregistrer les paramètres</button>
        </form>
        <div className="settings-side">
          <section className="settings-panel"><span className="settings-symbol">{cloudEnabled ? <Cloud /> : <Database />}</span><h2>{cloudEnabled ? 'Stockage privé activé' : 'Mode démonstration'}</h2><p>{cloudEnabled ? `Connecté avec ${user?.email}. Les données sont lues dans Supabase et jamais dans GitHub Pages.` : 'Les données restent dans le stockage local de ce navigateur. Elles ne sont pas partagées avec vos collègues.'}</p><button className="secondary-button" onClick={reload}><RefreshCw size={17} /> Recharger</button>{syncMessage && <p className="form-error">{syncMessage}</p>}</section>
          <section className="settings-panel"><span className="settings-symbol success"><ShieldCheck /></span><h2>Accès prévu</h2><ul><li>Responsable Bercher</li><li>Responsable Bezirksschule Brugg</li><li>Responsable Sekundarschule Brugg</li></ul><p>Les trois adresses exactes sont autorisées dans la base de données, pas dans le code public.</p></section>
        </div>
      </div>
      <section className="activity-panel"><h2>Activité récente</h2>{workspace.activity.length ? workspace.activity.slice(0, 10).map((item) => <p key={item.id}><time>{new Date(item.at).toLocaleString('fr-CH')}</time><span>{item.text}</span></p>) : <p>Aucune modification enregistrée pour le moment.</p>}</section>
    </div>
  )
}
