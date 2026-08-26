import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { evaluatePairing, fullName, scenarioStats } from '../lib/compatibility'

const genderSymbol = { female: '♀', male: '♂', unspecified: '•' }

function StudentRow({ student, assigned, selected, onToggle }) {
  const cues = []
  if (student.conditionType === 'regular_only') cues.push('partenaire habituel')
  if (student.conditionType === 'named_only') cues.push('personne précise')
  if (student.participation === 'travel_no_host') cues.push('accueil impossible')
  if (!student.acceptsOtherGender) cues.push('autre sexe: non')
  if (student.status === 'review') cues.push('fiche à vérifier')
  return (
    <button className={`student-row ${selected ? 'selected' : ''} ${assigned ? 'assigned' : ''}`} onClick={() => onToggle(student.id)} disabled={assigned}>
      <span className="selection-box">{selected ? <Check size={14} /> : assigned ? <Lock size={13} /> : null}</span>
      <span className={`gender-mark ${student.gender}`}>{genderSymbol[student.gender]}</span>
      <span className="student-row-main"><strong>{fullName(student)}</strong><small>{student.className}</small>{cues[0] && <em className={cues[0] === 'accueil impossible' ? 'danger-text' : ''}>• {cues[0]}</em>}</span>
      <span className="rotation-letter">{student.rotation || '–'}</span>
    </button>
  )
}

function StudentRail({ title, side, students, assigned, selectedIds, onToggle }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [school, setSchool] = useState('all')
  const items = students.filter((student) => {
    const matchText = `${fullName(student)} ${student.className}`.toLowerCase().includes(query.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'unassigned' ? !assigned.has(student.id) : student.status === 'review' || student.notes)
    const matchSchool = side === 'bercher' || school === 'all' || student.school === school
    return matchText && matchFilter && matchSchool && student.participation !== 'declined'
  })
  return (
    <section className="student-rail">
      <header><h2>{title}</h2>{side === 'brugg' && <select value={school} onChange={(event) => setSchool(event.target.value)} aria-label="Établissement de Brugg"><option value="all">Tous les établissements</option><option>Bezirksschule</option><option>Sekundarschule</option></select>}</header>
      <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" /></label>
      <div className="mini-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tous</button><button className={filter === 'unassigned' ? 'active' : ''} onClick={() => setFilter('unassigned')}>À placer</button><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Attention</button></div>
      <div className="student-list">{items.map((student) => <StudentRow key={student.id} student={student} assigned={assigned.has(student.id)} selected={selectedIds.has(student.id)} onToggle={onToggle} />)}{!items.length && <p className="empty-note">Aucun élève dans ce filtre.</p>}</div>
      <footer>{items.length} élève{items.length > 1 ? 's' : ''}</footer>
    </section>
  )
}

function PairingCard({ pairing, students, selected, onSelect }) {
  const result = evaluatePairing(pairing.memberIds, students)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  const missing = pairing.memberIds.length - members.length
  const status = result.conflicts.length ? 'conflict' : result.warnings.length ? 'warning' : 'success'
  return (
    <button className={`pairing-card ${selected ? 'selected' : ''} ${status}`} onClick={() => onSelect(pairing.id)}>
      <header><span>{members.length > 2 ? `Groupe 1 → ${members.length - 1}` : 'Binôme'}</span>{pairing.locked ? <Lock size={15} /> : <Unlock size={15} />}</header>
      <div className="pair-members">
        <div>{members.filter((student) => student.side === 'bercher').map((student) => <span key={student.id}><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}</div>
        <i aria-hidden="true" />
        <div>{members.filter((student) => student.side === 'brugg').map((student) => <span key={student.id}><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}{missing > 0 && <span className="missing-member"><strong>Élève introuvable</strong><small>À réparer</small></span>}</div>
      </div>
      <footer>{status === 'success' ? <CheckCircle2 /> : <AlertTriangle />}<span>{status === 'conflict' ? result.conflicts[0] : status === 'warning' ? `À vérifier (${result.score}/100)` : `Compatible (${result.score}/100)`}</span><b>{pairing.rotation || '–'}</b></footer>
    </button>
  )
}

function Inspector({ pairing, students, scenarioId, onClose }) {
  const { actions } = useWorkspace()
  if (!pairing) return <aside className="pairing-inspector empty"><UsersRound size={34} /><h2>Compatibilité</h2><p>Sélectionnez un binôme ou un groupe pour voir les conditions respectées et les points à vérifier.</p></aside>
  const result = evaluatePairing(pairing.memberIds, students)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  return (
    <aside className="pairing-inspector">
      <header><h2>Compatibilité</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
      <div className="inspector-members">{members.map((student) => <span key={student.id}><b className={`gender-mark ${student.gender}`}>{genderSymbol[student.gender]}</b><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}</div>
      <div className="score-block"><div className={`score-ring ${result.conflicts.length ? 'bad' : result.warnings.length ? 'medium' : ''}`}><strong>{result.score}</strong><small>/100</small></div><div><b>{result.conflicts.length ? 'Incompatible' : result.warnings.length ? 'À vérifier' : 'Très bon'}</b><p>{result.conflicts.length ? 'Une condition bloquante doit être corrigée.' : 'Ce groupe répond aux critères renseignés.'}</p></div></div>
      <label className="rotation-control">Rotation du groupe<select value={pairing.rotation || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { rotation: event.target.value })}><option value="">À décider</option><option value="A">A</option><option value="B">B</option></select></label>
      {!!result.respected.length && <section className="check-list success"><h3>Conditions respectées ({result.respected.length})</h3>{result.respected.map((item) => <p key={item}><CheckCircle2 /> {item}</p>)}</section>}
      {!!result.warnings.length && <section className="check-list warning"><h3>À vérifier ({result.warnings.length})</h3>{result.warnings.map((item) => <p key={item}><CircleDashed /> {item}</p>)}</section>}
      {!!result.conflicts.length && <section className="check-list danger"><h3>Contraintes non respectées ({result.conflicts.length})</h3>{result.conflicts.map((item) => <p key={item}><AlertTriangle /> {item}</p>)}</section>}
      <label>Note de travail<textarea rows="3" value={pairing.notes || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { notes: event.target.value })} /></label>
      <div className="inspector-actions">
        <button className="primary-button" disabled={result.conflicts.length > 0} onClick={() => actions.updatePairing(scenarioId, pairing.id, { locked: !pairing.locked })}>{pairing.locked ? <Unlock size={17} /> : <Lock size={17} />}{pairing.locked ? 'Déverrouiller' : 'Valider le groupe'}</button>
        <button className="danger-button" onClick={() => actions.removePairing(scenarioId, pairing.id)}><Trash2 size={17} /> Retirer</button>
      </div>
    </aside>
  )
}

export default function MatchingView() {
  const { workspace, actions } = useWorkspace()
  const scenario = workspace.scenarios.find((item) => item.id === workspace.activeScenarioId) || workspace.scenarios[0]
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedPairingId, setSelectedPairingId] = useState(scenario?.pairings[0]?.id || null)
  const assigned = useMemo(() => new Set(scenario?.pairings.flatMap((pairing) => pairing.memberIds) || []), [scenario])
  const stats = scenarioStats(scenario, workspace.students)
  const selectedPairing = scenario.pairings.find((pairing) => pairing.id === selectedPairingId)
  const toggle = (id) => setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const createGroup = () => {
    const members = [...selectedIds]
    const selectedStudents = members.map((id) => workspace.students.find((student) => student.id === id)).filter(Boolean)
    if (!selectedStudents.some((student) => student.side === 'bercher') || !selectedStudents.some((student) => student.side === 'brugg')) return
    const rotations = [...new Set(selectedStudents.map((student) => student.rotation).filter(Boolean))]
    const pairingId = actions.addPairing(scenario.id, members, rotations.length === 1 ? rotations[0] : '')
    setSelectedIds(new Set())
    setSelectedPairingId(pairingId)
  }
  const suggest = () => {
    const left = workspace.students.filter((student) => student.side === 'bercher' && !assigned.has(student.id) && student.participation !== 'declined')
    const right = workspace.students.filter((student) => student.side === 'brugg' && !assigned.has(student.id) && student.participation !== 'declined')
    const candidates = left.flatMap((a) => right.map((b) => ({ ids: [a.id, b.id], result: evaluatePairing([a.id, b.id], workspace.students) })))
      .sort((a, b) => a.result.conflicts.length - b.result.conflicts.length || b.result.score - a.result.score)
    if (!candidates[0]) return
    const [a, b] = candidates[0].ids.map((id) => workspace.students.find((student) => student.id === id))
    const pairingId = actions.addPairing(scenario.id, candidates[0].ids, a.rotation === b.rotation ? a.rotation : '')
    setSelectedPairingId(pairingId)
  }
  const newScenario = () => {
    const name = window.prompt('Nom du nouveau scénario', `Proposition ${workspace.scenarios.length + 1}`)
    if (name?.trim()) actions.addScenario(name.trim())
  }
  if (!scenario) return null
  const selectedSides = [...selectedIds].map((id) => workspace.students.find((student) => student.id === id)?.side)
  const canCreate = selectedSides.includes('bercher') && selectedSides.includes('brugg')
  return (
    <div className="view matching-view">
      <div className="view-heading">
        <div><h1>Appairages</h1><p>Construisez et comparez vos propositions sans perdre les versions précédentes.</p></div>
        <div className="button-row"><button className="secondary-button" onClick={suggest}><Sparkles size={18} /> Meilleure suggestion</button><button className="primary-button" onClick={newScenario}><Plus size={18} /> Créer un scénario</button></div>
      </div>
      <div className="scenario-tabs">{workspace.scenarios.map((item) => <button key={item.id} className={item.id === scenario.id ? 'active' : ''} onClick={() => { actions.setActiveScenario(item.id); setSelectedPairingId(item.pairings[0]?.id || null) }}>{item.name}{item.status === 'validated' && <Lock size={13} />}</button>)}<button className="add-tab" onClick={newScenario}><Plus /></button></div>
      <div className="stats-strip"><span><UsersRound /> <strong>{stats.assigned}</strong><small>appariés</small></span><span><CircleDashed /><strong>{stats.unassigned}</strong><small>à placer</small></span><span className={stats.alertCount ? 'warning' : ''}><AlertTriangle /><strong>{stats.alertCount}</strong><small>alertes</small></span><span><b>A</b><strong>{stats.groupA}</strong><small>groupe A</small></span><span><b>B</b><strong>{stats.groupB}</strong><small>groupe B</small></span></div>
      <div className="matching-workspace">
        <StudentRail title="Bercher" side="bercher" students={workspace.students.filter((student) => student.side === 'bercher')} assigned={assigned} selectedIds={selectedIds} onToggle={toggle} />
        <section className="pairing-canvas">
          <header><h2>Binômes et groupes</h2><span>{scenario.pairings.length} groupe{scenario.pairings.length > 1 ? 's' : ''}</span></header>
          <div className="pairing-stack">{scenario.pairings.map((pairing) => <PairingCard key={pairing.id} pairing={pairing} students={workspace.students} selected={pairing.id === selectedPairingId} onSelect={setSelectedPairingId} />)}</div>
          <button className={`drop-zone ${canCreate ? 'ready' : ''}`} disabled={!canCreate} onClick={createGroup}><UserPlus /><strong>{canCreate ? `Créer un groupe avec ${selectedIds.size} élèves` : 'Sélectionnez au moins un élève de chaque école'}</strong><small>Les appairages à trois sont acceptés.</small></button>
        </section>
        <StudentRail title="Brugg" side="brugg" students={workspace.students.filter((student) => student.side === 'brugg')} assigned={assigned} selectedIds={selectedIds} onToggle={toggle} />
        <Inspector pairing={selectedPairing} students={workspace.students} scenarioId={scenario.id} onClose={() => setSelectedPairingId(null)} />
      </div>
    </div>
  )
}
