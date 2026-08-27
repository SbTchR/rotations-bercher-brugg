import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  House,
  Link2,
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
import { calculateClassBalances } from '../lib/classBalance'
import {
  evaluatePairing,
  findStudentByName,
  fullName,
  getCorrespondentStatus,
  getTrackLabel,
  schoolLabel,
  scenarioStats,
} from '../lib/compatibility'

const genderSymbol = { female: '♀', male: '♂', unspecified: '•' }
const naturalCompare = (left, right) => left.localeCompare(right, 'fr-CH', { numeric: true, sensitivity: 'base' })

const conditionLabels = {
  none: 'Libre — aucune personne imposée',
  regular_only: 'Son correspondant actuel uniquement',
  different_only: 'Une autre personne que son correspondant',
  named_only: 'Une personne précise uniquement',
}

function groupByClass(students) {
  const groups = new Map()
  for (const student of students) {
    const className = student.className || 'Sans classe'
    if (!groups.has(className)) groups.set(className, [])
    groups.get(className).push(student)
  }
  return [...groups.entries()].sort(([left], [right]) => naturalCompare(left, right))
}

function StudentRow({ student, assigned, selected, inspected, onSelect }) {
  const cues = []
  if (student.conditionType === 'regular_only') cues.push('son correspondant')
  if (student.conditionType === 'different_only') cues.push('autre personne')
  if (student.conditionType === 'named_only') cues.push('personne précise')
  if (!student.acceptsOtherGender) cues.push('même sexe uniquement')
  if (student.participation === 'host_only') cues.push('accueille seulement')
  if (student.requiredRotation) cues.push(`groupe ${student.requiredRotation} indispensable`)
  if (student.active === false) cues.push('échange refusé')
  if (student.status === 'review') cues.push('fiche à vérifier')
  return (
    <button className={`student-row ${selected ? 'selected' : ''} ${inspected ? 'inspected' : ''} ${assigned ? 'assigned' : ''} ${student.active === false ? 'inactive' : ''}`} onClick={() => onSelect(student)} aria-pressed={selected}>
      <span className="selection-box">{selected ? <Check size={14} /> : assigned ? <Lock size={13} /> : null}</span>
      <span className={`gender-mark ${student.gender}`}>{genderSymbol[student.gender]}</span>
      <span className="student-row-main"><strong>{fullName(student)}</strong><small>{schoolLabel(student.school)} · {student.className}</small>{cues[0] && <em>• {cues[0]}</em>}</span>
      <span className="rotation-letter">{student.requiredRotation || '–'}</span>
    </button>
  )
}

function StudentRail({ title, side, students, assigned, selectedIds, inspectedId, onSelect }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [school, setSchool] = useState('all')
  const items = students.filter((student) => {
    const matchText = `${fullName(student)} ${student.className}`.toLowerCase().includes(query.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'unassigned' ? !assigned.has(student.id) && student.active !== false && student.participation !== 'host_only' : student.status === 'review' || student.otherInfo || student.notes || student.active === false)
    const matchSchool = school === 'all' || student.school === school
    return matchText && matchFilter && matchSchool
  })
  const grouped = groupByClass(items)
  return (
    <section className="student-rail">
      <header><h2>{title}</h2><select value={school} onChange={(event) => setSchool(event.target.value)} aria-label={`Filière de ${title}`}><option value="all">Toutes les filières</option>{side === 'bercher' ? <><option value="VP">VP · Bercher</option><option value="VG">VG · Bercher</option></> : <><option value="Bezirksschule">Bez · Brugg</option><option value="Sekundarschule">Sek · Brugg</option></>}</select></header>
      <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" /></label>
      <div className="mini-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tous</button><button className={filter === 'unassigned' ? 'active' : ''} onClick={() => setFilter('unassigned')}>À placer</button><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Attention</button></div>
      <div className="student-list">{grouped.map(([className, classStudents]) => <section className="rail-class-group" key={className}><header><strong>{className}</strong><span>{classStudents.length}</span></header>{classStudents.map((student) => <StudentRow key={student.id} student={student} assigned={assigned.has(student.id)} selected={selectedIds.has(student.id)} inspected={inspectedId === student.id} onSelect={onSelect} />)}</section>)}{!items.length && <p className="empty-note">Aucun élève dans ce filtre.</p>}</div>
      <footer>{items.length} élève{items.length > 1 ? 's' : ''} · {grouped.length} classe{grouped.length > 1 ? 's' : ''}</footer>
    </section>
  )
}

function PairingCard({ pairing, students, selected, onSelect, onDragStart, onDragEnd }) {
  const result = evaluatePairing(pairing.memberIds, students, pairing.rotation)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  const missing = pairing.memberIds.length - members.length
  const status = result.conflicts.length ? 'conflict' : result.warnings.length ? 'warning' : 'success'
  return (
    <button className={`pairing-card ${selected ? 'selected' : ''} ${status}`} onClick={() => onSelect(pairing.id)} draggable onDragStart={(event) => onDragStart(event, pairing.id)} onDragEnd={onDragEnd}>
      <header><span>{members.length} élève{members.length > 1 ? 's' : ''} · glisser pour déplacer</span>{pairing.locked ? <Lock size={15} /> : <Unlock size={15} />}</header>
      <div className="pair-members">
        <div>{members.filter((student) => student.side === 'bercher').map((student) => <span key={student.id}><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}</div>
        <i aria-hidden="true" />
        <div>{members.filter((student) => student.side === 'brugg').map((student) => <span key={student.id}><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}{missing > 0 && <span className="missing-member"><strong>Élève introuvable</strong><small>À réparer</small></span>}</div>
      </div>
      <footer>{status === 'success' ? <CheckCircle2 /> : <AlertTriangle />}<span>{status === 'conflict' ? result.conflicts[0] : status === 'warning' ? `À vérifier (${result.score}/100)` : `Compatible (${result.score}/100)`}</span><b>{pairing.rotation || '–'}</b></footer>
    </button>
  )
}

function StudentInspector({ student, students, onClose }) {
  const correspondent = getCorrespondentStatus(student, students)
  const requested = student.conditionType === 'named_only'
    ? findStudentByName(student.namedPartner, students, student.side === 'bercher' ? 'brugg' : 'bercher')
    : null
  return (
    <aside className="pairing-inspector student-inspector">
      <header><div><h2>Conditions de l’élève</h2><small>{student.school} · {student.className}</small></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
      <div className="student-inspector-title"><span className={`gender-mark ${student.gender}`}>{genderSymbol[student.gender]}</span><div><strong>{fullName(student)}</strong><small>{getTrackLabel(student)}</small></div></div>
      <section className="condition-summary">
        <div><span>Condition de groupe</span><strong className="rotation-value">{student.requiredRotation ? `Uniquement groupe ${student.requiredRotation}` : 'Aucune condition spécifiée'}</strong></div>
        <div><span>Choix du partenaire</span><strong>{conditionLabels[student.conditionType] || 'Libre'}</strong></div>
        <div><span>Partenaire d’un autre sexe</span><strong>{student.acceptsOtherGender ? 'Accepté' : 'Non accepté'}</strong></div>
        <div><span>Participation</span><strong>{student.participation === 'host_only' ? 'N’accueille que des visiteurs' : student.canHost ? 'Participe et peut accueillir' : 'Participe sans pouvoir accueillir'}</strong></div>
        <div><span>Décision</span><strong>{student.active === false ? 'Échange refusé — fiche conservée' : 'Élève maintenu dans l’échange'}</strong></div>
      </section>
      <section className={`correspondent-card ${correspondent.state}`}><Link2 /><div><span>Correspondant actuel</span><strong>{correspondent.name || 'Non renseigné'}</strong><small>{correspondent.state === 'found' ? `Ajouté · ${fullName(correspondent.student)} (${correspondent.student.className})` : correspondent.state === 'missing' ? 'Pas encore ajouté dans l’application' : 'L’élève reste libre si aucune condition ne l’impose.'}</small></div></section>
      {student.conditionType === 'named_only' && <section className={`correspondent-card ${requested ? 'found' : 'missing'}`}><UserPlus /><div><span>Personne demandée</span><strong>{student.namedPartner || 'Non renseignée'}</strong><small>{requested ? `Ajoutée · ${fullName(requested)} (${requested.className})` : 'Pas encore ajoutée dans l’application'}</small></div></section>}
      {(student.otherInfo || student.notes || student.groupPreference || student.animals) && <section className="student-extra-details"><h3>Autres infos utiles</h3><p className="confidential-detail"><span>{student.otherInfo || [student.animals, student.groupPreference, student.notes].filter(Boolean).join('\n')}</span></p></section>}
    </aside>
  )
}

function GroupInspector({ pairing, students, scenarioId, onClose }) {
  const { actions } = useWorkspace()
  const result = evaluatePairing(pairing.memberIds, students, pairing.rotation)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  const hostClasses = (side) => [...new Set(members.filter((student) => student.side === side).map((student) => student.className).filter(Boolean))]
  const bercherClasses = hostClasses('bercher')
  const bruggClasses = hostClasses('brugg')
  const hostControl = (label, key, classes) => <label className="host-class-control">{label}<select value={pairing[key] || classes[0] || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { [key]: event.target.value })}>{classes.map((className) => <option key={className}>{className}</option>)}</select></label>
  return (
    <aside className="pairing-inspector">
      <header><h2>Compatibilité du groupe</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
      <div className="inspector-members">{members.map((student) => <span key={student.id}><b className={`gender-mark ${student.gender}`}>{genderSymbol[student.gender]}</b><strong>{fullName(student)}</strong><small>{student.className}</small></span>)}</div>
      <div className="score-block"><div className={`score-ring ${result.conflicts.length ? 'bad' : result.warnings.length ? 'medium' : ''}`}><strong>{result.score}</strong><small>/100</small></div><div><b>{result.conflicts.length ? 'Conditions indispensables non respectées' : result.warnings.length ? 'Conditions à vérifier' : 'Conditions remplies'}</b><p>{result.conflicts.length ? 'Ce groupe ne peut pas être validé en l’état.' : 'Les conditions sont classées ci-dessous par importance.'}</p></div></div>
      <label className="rotation-control">Bloc du groupe<select value={pairing.rotation || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { rotation: event.target.value })}><option value="">À décider</option><option value="A">Bloc A</option><option value="B">Bloc B</option></select></label>
      <div className="host-class-grid">{hostControl('Classe d’accueil à Bercher', 'bercherHostClass', bercherClasses)}{hostControl('Classe d’accueil à Brugg', 'bruggHostClass', bruggClasses)}</div>
      <ConditionList title="Conditions indispensables" items={result.conditions.indispensable} essential />
      <ConditionList title="Conditions facultatives" items={result.conditions.optional} />
      <label>Note de travail<textarea rows="3" value={pairing.notes || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { notes: event.target.value })} /></label>
      <div className="inspector-actions">
        <button className="primary-button" disabled={result.conflicts.length > 0} onClick={() => actions.updatePairing(scenarioId, pairing.id, { locked: !pairing.locked })}>{pairing.locked ? <Unlock size={17} /> : <Lock size={17} />}{pairing.locked ? 'Déverrouiller' : 'Valider le groupe'}</button>
        <button className="danger-button" onClick={() => actions.removePairing(scenarioId, pairing.id)}><Trash2 size={17} /> Retirer</button>
      </div>
    </aside>
  )
}

function ConditionList({ title, items, essential = false }) {
  if (!items.length) return null
  return <section className={`check-list conditions-list ${essential ? 'essential' : 'optional'}`}><h3>{title}</h3>{items.map((item) => {
    const Marker = item.state === 'pass' ? CheckCircle2 : item.state === 'fail' ? AlertTriangle : CircleDashed
    return <p key={`${item.state}-${item.label}`} className={item.state}><Marker /> <span>{item.label}</span></p>
  })}</section>
}

function Inspector({ student, pairing, students, scenarioId, onClose }) {
  if (student) return <StudentInspector student={student} students={students} onClose={onClose} />
  if (pairing) return <GroupInspector pairing={pairing} students={students} scenarioId={scenarioId} onClose={onClose} />
  return <aside className="pairing-inspector empty"><UsersRound size={34} /><h2>Conditions</h2><p>Sélectionnez un élève pour voir sa fiche résumée, ou un groupe pour contrôler sa compatibilité.</p></aside>
}

function RotationBlock({ rotation, pairings, students, selectedPairingId, onSelect, description, onDrop, onDragStart, onDragEnd, onDragHover, dropTarget }) {
  return (
    <section className={`rotation-block rotation-${rotation.toLowerCase()} ${dropTarget ? 'drop-target' : ''}`} onDragOver={(event) => { event.preventDefault(); onDragHover(rotation) }} onDrop={(event) => onDrop(event, rotation)}>
      <header><div><span>Bloc {rotation}</span><small>{description}</small></div><strong>{pairings.length} groupe{pairings.length > 1 ? 's' : ''}</strong></header>
      <div className="pairing-stack">{pairings.map((pairing) => <PairingCard key={pairing.id} pairing={pairing} students={students} selected={pairing.id === selectedPairingId} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={onDragEnd} />)}{!pairings.length && <p className="empty-block">Déposez un groupe ici.</p>}</div>
    </section>
  )
}

function BalanceValue({ value, net = false }) {
  const label = net && value > 0 ? `+${value}` : value || '—'
  return <span className={net ? value > 0 ? 'net-positive' : value < 0 ? 'net-negative' : 'net-zero' : ''}>{label}</span>
}

function ClassBalancePanel({ scenario, students }) {
  const { balances, undecidedPairings } = useMemo(() => calculateClassBalances(scenario, students), [scenario, students])
  const groups = balances.reduce((map, row) => {
    if (!map.has(row.school)) map.set(row.school, [])
    map.get(row.school).push(row)
    return map
  }, new Map())
  return (
    <section className="class-balance-panel">
      <header><div><h2>Présence dans les classes</h2><p>Le solde indique combien d’élèves la classe gagne ou perd pendant chaque partie de la semaine.</p></div><House /></header>
      {undecidedPairings > 0 && <div className="balance-warning"><AlertTriangle /> {undecidedPairings} groupe{undecidedPairings > 1 ? 's ne sont' : ' n’est'} pas encore compté{undecidedPairings > 1 ? 's' : ''}, car le bloc A/B reste à décider.</div>}
      <div className="balance-table-wrapper"><table className="balance-table">
        <thead><tr><th rowSpan="2">Classe</th><th colSpan="3">1re partie de la semaine</th><th colSpan="3">2e partie de la semaine</th></tr><tr><th>Partent</th><th>Arrivent</th><th>Solde</th><th>Partent</th><th>Arrivent</th><th>Solde</th></tr></thead>
        {[...groups.entries()].map(([school, rows]) => <tbody key={school}><tr className="balance-school-row"><th colSpan="7">{school}</th></tr>{rows.map((row) => <tr key={row.key}><th>{row.className}</th><td><BalanceValue value={row.first.outgoing} /></td><td><BalanceValue value={row.first.incoming} /></td><td><BalanceValue value={row.first.net} net /></td><td><BalanceValue value={row.second.outgoing} /></td><td><BalanceValue value={row.second.incoming} /></td><td><BalanceValue value={row.second.net} net /></td></tr>)}</tbody>)}
      </table></div>
      <footer>Solde = arrivées − départs. Une valeur négative signifie qu’il y aura moins d’élèves dans la classe.</footer>
    </section>
  )
}

export default function MatchingView() {
  const { workspace, actions } = useWorkspace()
  const scenario = workspace.scenarios.find((item) => item.id === workspace.activeScenarioId) || workspace.scenarios[0]
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedPairingId, setSelectedPairingId] = useState(null)
  const [newGroupRotation, setNewGroupRotation] = useState('A')
  const [draggedPairingId, setDraggedPairingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const assigned = useMemo(() => new Set(scenario?.pairings.flatMap((pairing) => pairing.memberIds) || []), [scenario])
  if (!scenario) return null
  const stats = scenarioStats(scenario, workspace.students)
  const selectedPairing = scenario.pairings.find((pairing) => pairing.id === selectedPairingId)
  const selectedStudent = workspace.students.find((student) => student.id === selectedStudentId)
  const selectStudent = (student) => {
    setSelectedStudentId(student.id)
    setSelectedPairingId(null)
    if (assigned.has(student.id) || student.participation === 'host_only' || student.active === false) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(student.id)) next.delete(student.id)
      else next.add(student.id)
      return next
    })
  }
  const selectPairing = (id) => { setSelectedPairingId(id); setSelectedStudentId(null) }
  const createGroup = () => {
    const members = [...selectedIds]
    const selectedStudents = members.map((id) => workspace.students.find((student) => student.id === id)).filter(Boolean)
    if (!selectedStudents.some((student) => student.side === 'bercher') || !selectedStudents.some((student) => student.side === 'brugg')) return
    const pairingId = actions.addPairing(scenario.id, members, newGroupRotation, {
      bercherHostClass: selectedStudents.find((student) => student.side === 'bercher')?.className || '',
      bruggHostClass: selectedStudents.find((student) => student.side === 'brugg')?.className || '',
    })
    setSelectedIds(new Set())
    selectPairing(pairingId)
  }
  const suggest = () => {
    const left = workspace.students.filter((student) => student.side === 'bercher' && student.participation !== 'host_only' && student.active !== false && !assigned.has(student.id))
    const right = workspace.students.filter((student) => student.side === 'brugg' && student.participation !== 'host_only' && student.active !== false && !assigned.has(student.id))
    const candidates = left.flatMap((a) => right.map((b) => {
      const alternatives = ['A', 'B'].map((rotation) => ({ rotation, result: evaluatePairing([a.id, b.id], workspace.students, rotation) }))
      alternatives.sort((first, second) => first.result.conflicts.length - second.result.conflicts.length || first.result.warnings.length - second.result.warnings.length || second.result.score - first.result.score)
      return { ids: [a.id, b.id], ...alternatives[0] }
    })).sort((a, b) => a.result.conflicts.length - b.result.conflicts.length || a.result.warnings.length - b.result.warnings.length || b.result.score - a.result.score)
    if (!candidates[0]) return
    const [a, b] = candidates[0].ids.map((id) => workspace.students.find((student) => student.id === id))
    const pairingId = actions.addPairing(scenario.id, candidates[0].ids, candidates[0].rotation, { bercherHostClass: a.className, bruggHostClass: b.className })
    selectPairing(pairingId)
  }
  const newScenario = () => {
    const name = window.prompt('Nom du nouveau scénario', `Proposition ${workspace.scenarios.length + 1}`)
    if (name?.trim()) actions.addScenario(name.trim())
  }
  const selectedSides = [...selectedIds].map((id) => workspace.students.find((student) => student.id === id)?.side)
  const canCreate = selectedSides.includes('bercher') && selectedSides.includes('brugg')
  const blockA = scenario.pairings.filter((pairing) => pairing.rotation === 'A')
  const blockB = scenario.pairings.filter((pairing) => pairing.rotation === 'B')
  const undecided = scenario.pairings.filter((pairing) => !pairing.rotation)
  const movePairing = (event, rotation) => {
    event.preventDefault()
    const pairingId = event.dataTransfer.getData('text/plain') || draggedPairingId
    if (pairingId) actions.updatePairing(scenario.id, pairingId, { rotation })
    setDraggedPairingId(null)
    setDropTarget(null)
  }
  const beginDrag = (event, pairingId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pairingId)
    setDraggedPairingId(pairingId)
  }
  return (
    <div className="view matching-view">
      <div className="view-heading">
        <div><h1>Appairages</h1><p>Construisez et comparez vos propositions sans perdre les versions précédentes.</p></div>
        <div className="button-row"><button className="secondary-button" onClick={suggest}><Sparkles size={18} /> Meilleure suggestion</button><button className="primary-button" onClick={newScenario}><Plus size={18} /> Créer un scénario</button></div>
      </div>
      <div className="scenario-tabs">{workspace.scenarios.map((item) => <button key={item.id} className={item.id === scenario.id ? 'active' : ''} onClick={() => { actions.setActiveScenario(item.id); setSelectedPairingId(null); setSelectedStudentId(null); setSelectedIds(new Set()) }}>{item.name}{item.status === 'validated' && <Lock size={13} />}</button>)}<button className="add-tab" onClick={newScenario}><Plus /></button></div>
      <div className="stats-strip"><span><UsersRound /> <strong>{stats.assigned}</strong><small>appariés</small></span><span><CircleDashed /><strong>{stats.unassigned}</strong><small>à placer</small></span><span className={stats.alertCount ? 'warning' : ''}><AlertTriangle /><strong>{stats.alertCount}</strong><small>alertes</small></span><span><b>A</b><strong>{stats.groupA}</strong><small>groupes</small></span><span><b>B</b><strong>{stats.groupB}</strong><small>groupes</small></span></div>
      <div className="matching-workspace">
        <StudentRail title="Bercher" side="bercher" students={workspace.students.filter((student) => student.side === 'bercher')} assigned={assigned} selectedIds={selectedIds} inspectedId={selectedStudentId} onSelect={selectStudent} />
        <section className="pairing-canvas">
          <header><h2>Blocs d’échange</h2><span>{scenario.pairings.length} groupe{scenario.pairings.length > 1 ? 's' : ''} au total</span></header>
          <RotationBlock rotation="A" pairings={blockA} students={workspace.students} selectedPairingId={selectedPairingId} onSelect={selectPairing} description="Bercher voyage d’abord" onDrop={movePairing} onDragStart={beginDrag} onDragEnd={() => { setDraggedPairingId(null); setDropTarget(null) }} onDragHover={setDropTarget} dropTarget={dropTarget === 'A'} />
          <RotationBlock rotation="B" pairings={blockB} students={workspace.students} selectedPairingId={selectedPairingId} onSelect={selectPairing} description="Brugg voyage d’abord" onDrop={movePairing} onDragStart={beginDrag} onDragEnd={() => { setDraggedPairingId(null); setDropTarget(null) }} onDragHover={setDropTarget} dropTarget={dropTarget === 'B'} />
          {!!undecided.length && <section className="rotation-block rotation-undecided"><header><div><span>À décider</span><small>Bloc encore non attribué</small></div><strong>{undecided.length} groupe{undecided.length > 1 ? 's' : ''}</strong></header><div className="pairing-stack">{undecided.map((pairing) => <PairingCard key={pairing.id} pairing={pairing} students={workspace.students} selected={pairing.id === selectedPairingId} onSelect={selectPairing} />)}</div></section>}
          <div className={`drop-zone ${canCreate ? 'ready' : ''}`}><UserPlus /><strong>{canCreate ? `Créer un groupe avec ${selectedIds.size} élèves` : 'Sélectionnez au moins un élève de chaque école'}</strong><small>Les appairages à trois sont acceptés.</small><div className="new-group-controls"><span>Placer dans</span><button type="button" className={newGroupRotation === 'A' ? 'active' : ''} onClick={() => setNewGroupRotation('A')}>Bloc A</button><button type="button" className={newGroupRotation === 'B' ? 'active' : ''} onClick={() => setNewGroupRotation('B')}>Bloc B</button><button className="primary-button compact" disabled={!canCreate} onClick={createGroup}>Créer</button></div></div>
        </section>
        <StudentRail title="Brugg" side="brugg" students={workspace.students.filter((student) => student.side === 'brugg')} assigned={assigned} selectedIds={selectedIds} inspectedId={selectedStudentId} onSelect={selectStudent} />
        <Inspector student={selectedStudent} pairing={selectedPairing} students={workspace.students} scenarioId={scenario.id} onClose={() => { setSelectedStudentId(null); setSelectedPairingId(null) }} />
      </div>
      <ClassBalancePanel scenario={scenario} students={workspace.students} />
    </div>
  )
}
