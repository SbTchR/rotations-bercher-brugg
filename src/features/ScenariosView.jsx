import { AlertTriangle, CheckCircle2, Copy, Lock, Pencil, Plus } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { scenarioStats } from '../lib/compatibility'

export default function ScenariosView({ onNavigate }) {
  const { workspace, actions } = useWorkspace()
  const create = () => {
    const name = window.prompt('Nom du nouveau scénario', `Proposition ${workspace.scenarios.length + 1}`)
    if (name?.trim()) actions.addScenario(name.trim())
  }
  const clone = (scenario) => {
    const name = window.prompt('Nom de la copie', `${scenario.name} — copie`)
    if (name?.trim()) actions.cloneScenario(scenario.id, name.trim())
  }
  return (
    <div className="view scenarios-view">
      <div className="view-heading"><div><h1>Scénarios</h1><p>Conservez plusieurs essais et choisissez la version commune seulement lorsqu’elle est prête.</p></div><button className="primary-button" onClick={create}><Plus size={18} /> Nouveau scénario</button></div>
      <section className="scenario-list">
        <header><span>Nom</span><span>Progression</span><span>Groupes</span><span>État</span><span /></header>
        {workspace.scenarios.map((scenario) => {
          const stats = scenarioStats(scenario, workspace.students)
          return <article key={scenario.id} className={workspace.activeScenarioId === scenario.id ? 'active' : ''}>
            <div><strong>{scenario.name}</strong><small>Modifié {new Date(scenario.updatedAt).toLocaleDateString('fr-CH')}</small></div>
            <div className="scenario-progress"><i><b style={{ width: `${stats.assigned / Math.max(workspace.students.length, 1) * 100}%` }} /></i><span>{stats.assigned} placés · {stats.unassigned} à placer</span></div>
            <span>{scenario.pairings.length}</span>
            <span className={`status-label ${scenario.status === 'validated' ? 'success' : stats.alertCount ? 'warning' : ''}`}>{scenario.status === 'validated' ? <><Lock /> Validé</> : stats.alertCount ? <><AlertTriangle /> {stats.alertCount} alerte{stats.alertCount > 1 ? 's' : ''}</> : <><CheckCircle2 /> Brouillon propre</>}</span>
            <div className="row-actions"><button className="icon-button" onClick={() => clone(scenario)} title="Dupliquer"><Copy /></button><button className="secondary-button compact" onClick={() => { actions.setActiveScenario(scenario.id); onNavigate('matching') }}><Pencil size={16} /> Ouvrir</button></div>
          </article>
        })}
      </section>
      <div className="scenario-guidance"><h2>Une version sans risque</h2><p>Les modifications d’un scénario n’affectent pas les autres. Les groupes verrouillés restent visibles, mais peuvent toujours être déverrouillés si une nouvelle information arrive.</p></div>
    </div>
  )
}
