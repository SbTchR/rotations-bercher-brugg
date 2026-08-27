import { AlertTriangle, CheckCircle2, Copy, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ScenarioModal from '../components/ScenarioModal'
import { useWorkspace } from '../context/WorkspaceContext'
import { accountLabel } from '../lib/accounts'
import { scenarioStats } from '../lib/compatibility'

export default function ScenariosView({ onNavigate }) {
  const { workspace, actions, user } = useWorkspace()
  const [modal, setModal] = useState(null)
  const create = () => setModal({ mode: 'create' })
  const clone = (scenario) => setModal({ mode: 'clone', scenario })
  const remove = (scenario) => {
    if (workspace.scenarios.length === 1) {
      window.alert('Il faut conserver au moins un scénario.')
      return
    }
    if (window.confirm(`Supprimer définitivement le scénario « ${scenario.name} » ?\n\nVous pourrez encore annuler cette action depuis la barre du haut.`)) actions.removeScenario(scenario.id)
  }
  const saveScenario = ({ name, createdBy }) => {
    if (modal?.mode === 'clone') actions.cloneScenario(modal.scenario.id, name, createdBy)
    else actions.addScenario(name, createdBy)
    setModal(null)
  }
  return (
    <div className="view scenarios-view">
      <div className="view-heading"><div><h1>Scénarios</h1><p>Conservez plusieurs essais et choisissez la version commune seulement lorsqu’elle est prête.</p></div><button className="primary-button" onClick={create}><Plus size={18} /> Nouveau scénario</button></div>
      <section className="scenario-list">
        <header><span>Nom</span><span>Progression</span><span>Groupes</span><span>État</span><span /></header>
        {workspace.scenarios.map((scenario) => {
          const stats = scenarioStats(scenario, workspace.students)
          return <article key={scenario.id} className={workspace.activeScenarioId === scenario.id ? 'active' : ''}>
            <div><strong>{scenario.name}</strong><small>Créé par : {scenario.createdBy || 'non indiqué'} · modifié {new Date(scenario.updatedAt).toLocaleDateString('fr-CH')}</small></div>
            <div className="scenario-progress"><i><b style={{ width: `${stats.assigned / Math.max(workspace.students.length, 1) * 100}%` }} /></i><span>{stats.assigned} placés · {stats.unassigned} à placer</span></div>
            <span>{scenario.pairings.length}</span>
            <span className={`status-label ${scenario.status === 'validated' ? 'success' : stats.alertCount ? 'warning' : ''}`}>{scenario.status === 'validated' ? <><Lock /> Validé</> : stats.alertCount ? <><AlertTriangle /> {stats.alertCount} alerte{stats.alertCount > 1 ? 's' : ''}</> : <><CheckCircle2 /> Brouillon propre</>}</span>
            <div className="row-actions"><button className="icon-button" onClick={() => clone(scenario)} title="Dupliquer"><Copy /></button><button className="icon-button danger-icon" onClick={() => remove(scenario)} title="Supprimer" aria-label={`Supprimer ${scenario.name}`}><Trash2 /></button><button className="secondary-button compact" onClick={() => { actions.setActiveScenario(scenario.id); onNavigate('matching') }}><Pencil size={16} /> Ouvrir</button></div>
          </article>
        })}
      </section>
      <div className="scenario-guidance"><h2>Une version sans risque</h2><p>Les modifications d’un scénario n’affectent pas les autres. Les groupes verrouillés restent visibles, mais peuvent toujours être déverrouillés si une nouvelle information arrive.</p></div>
      {modal && <ScenarioModal title={modal.mode === 'clone' ? 'Dupliquer le scénario' : 'Nouveau scénario'} initialName={modal.mode === 'clone' ? `${modal.scenario.name} — copie` : `Proposition ${workspace.scenarios.length + 1}`} initialCreatedBy={accountLabel(user?.email)} onClose={() => setModal(null)} onSave={saveScenario} />}
    </div>
  )
}
