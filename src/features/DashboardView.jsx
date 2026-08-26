import { AlertTriangle, ArrowLeftRight, CheckCircle2, ClipboardList, Cloud, Database, UsersRound } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { evaluatePairing, scenarioStats } from '../lib/compatibility'

export default function DashboardView({ onNavigate }) {
  const { workspace, cloudEnabled } = useWorkspace()
  const scenario = workspace.scenarios.find((item) => item.id === workspace.activeScenarioId) || workspace.scenarios[0]
  const stats = scenarioStats(scenario, workspace.students)
  const incomplete = workspace.students.filter((student) => student.status === 'review').length
  const hardConflicts = scenario.pairings.reduce((sum, pairing) => sum + evaluatePairing(pairing.memberIds, workspace.students).conflicts.length, 0)
  const schools = [
    ['Bercher', workspace.students.filter((student) => student.school === 'Bercher').length],
    ['Bezirksschule', workspace.students.filter((student) => student.school === 'Bezirksschule').length],
    ['Sekundarschule', workspace.students.filter((student) => student.school === 'Sekundarschule').length],
  ]
  return (
    <div className="view dashboard-view">
      <div className="view-heading"><div><h1>Vue d’ensemble</h1><p>Suivez les inscriptions, les appairages et les points qui demandent une décision.</p></div><button className="primary-button" onClick={() => onNavigate('matching')}><ArrowLeftRight size={18} /> Continuer les appairages</button></div>
      <section className="overview-band">
        <div className="overview-main"><span className="big-number">{stats.assigned}</span><div><h2>élèves déjà placés</h2><p>dans « {scenario.name} »</p></div></div>
        <div className="overview-metrics"><span><strong>{stats.unassigned}</strong> à placer</span><span className={hardConflicts ? 'danger-text' : ''}><strong>{hardConflicts}</strong> contraintes bloquantes</span><span><strong>{incomplete}</strong> fiches à vérifier</span></div>
      </section>
      <div className="dashboard-columns">
        <section className="open-panel">
          <header><div><h2>Inscriptions par établissement</h2><p>Élèves présents dans l’espace de travail</p></div><button className="text-button" onClick={() => onNavigate('students')}>Ouvrir</button></header>
          <div className="school-bars">{schools.map(([name, count]) => <div key={name}><span><b>{name}</b><strong>{count}</strong></span><i><b style={{ width: `${Math.max(8, (count / Math.max(...schools.map((item) => item[1]), 1)) * 100)}%` }} /></i></div>)}</div>
        </section>
        <section className="open-panel next-actions">
          <header><div><h2>À traiter maintenant</h2><p>Les contrôles les plus utiles</p></div></header>
          <button onClick={() => onNavigate('students')}><span className="action-icon coral"><ClipboardList /></span><span><strong>Compléter les fiches</strong><small>{incomplete} fiche{incomplete > 1 ? 's' : ''} importée{incomplete > 1 ? 's' : ''} ou incomplète{incomplete > 1 ? 's' : ''}</small></span></button>
          <button onClick={() => onNavigate('matching')}><span className="action-icon gold"><AlertTriangle /></span><span><strong>Résoudre les conflits</strong><small>{hardConflicts || 'Aucune'} condition{hardConflicts > 1 ? 's' : ''} bloquante{hardConflicts > 1 ? 's' : ''}</small></span></button>
          <button onClick={() => onNavigate('scenarios')}><span className="action-icon green"><CheckCircle2 /></span><span><strong>Comparer les scénarios</strong><small>{workspace.scenarios.length} propositions enregistrées</small></span></button>
        </section>
      </div>
      <section className="privacy-band"><span className="action-icon teal">{cloudEnabled ? <Cloud /> : <Database />}</span><div><h2>{cloudEnabled ? 'Données partagées et protégées' : 'Démonstration locale'}</h2><p>{cloudEnabled ? 'Seules les trois adresses autorisées peuvent accéder aux fiches. GitHub Pages ne contient aucune donnée d’élève.' : 'Les modifications restent uniquement dans ce navigateur. Activez Supabase avant le travail réel à trois.'}</p></div><UsersRound /></section>
    </div>
  )
}
