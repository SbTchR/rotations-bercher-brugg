import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleHelp,
  CircleX,
  House,
  HousePlus,
  Link2,
  Link2Off,
  ListFilter,
  Lock,
  Pencil,
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
import MatchingDiscussion, { DiscussionBadge, DiscussionButton } from '../components/MatchingDiscussion'
import MatchingReviewModal from '../components/MatchingReviewModal'
import ScenarioModal from '../components/ScenarioModal'
import StudentDrawer from '../components/StudentDrawer'
import { useWorkspace } from '../context/WorkspaceContext'
import { accountLabel } from '../lib/accounts'
import { calculateClassBalances } from '../lib/classBalance'
import {
  createPairingEvaluator,
  findStudentByName,
  fullName,
  getCorrespondentStatus,
  hostCapacity,
  schoolLabel,
  scenarioStats,
} from '../lib/compatibility'
import { canAppendPairings, canConfirmPairing } from '../lib/pairingBatch'
import { getMatchingComments } from '../lib/matchingComments'
import { getScenarioDecision, isMaintainedInScenario, scenarioDecisionLabels } from '../lib/scenarioParticipation'

const genderSymbol = { female: '♀', male: '♂', unspecified: '•' }
const genderLabel = { female: 'Fille', male: 'Garçon', unspecified: 'Genre non renseigné' }
const naturalCompare = (left, right) => left.localeCompare(right, 'fr-CH', { numeric: true, sensitivity: 'base' })

const conditionLabels = {
  none: 'Aucune personne imposée',
  regular_only: 'Un correspondant habituel uniquement',
  different_only: 'Aucun correspondant habituel',
  named_only: 'Une personne précise uniquement',
}

const usualBadges = {
  mutual: { Icon: Link2, text: 'Habituels', hint: 'Les correspondants habituels se reconnaissent mutuellement.' },
  different: { Icon: Link2Off, text: 'Autres partenaires', hint: 'Un correspondant habituel identifié se trouve hors du groupe.' },
  partial: { Icon: Link2, text: 'Lien partiel', hint: 'Un lien habituel est reconnu dans un seul sens ou pour une partie du groupe.' },
  ambiguous: { Icon: CircleHelp, text: 'Nom à préciser', hint: 'Plusieurs élèves peuvent correspondre à un nom saisi.' },
  unknown: { Icon: CircleHelp, text: 'Lien indéterminé', hint: 'Il manque un nom ou une fiche pour établir le lien habituel.' },
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

function Cue({ icon: Icon, label, tone = 'neutral', children }) {
  return <span className={`matching-cue ${tone}`} role="img" aria-label={label} title={label}><Icon size={13} aria-hidden="true" />{children}</span>
}

function HostingCue({ student }) {
  const places = hostCapacity(student)
  const hostOnly = student.participation === 'host_only'
  if (!places) return <Cue icon={House} tone="unavailable" label="Accueil impossible"><span aria-hidden="true">0</span></Cue>
  return (
    <Cue icon={places > 1 ? HousePlus : House} tone={hostOnly ? 'info' : 'available'} label={`${hostOnly ? 'Accueil sans voyage · ' : ''}${places} place${places > 1 ? 's' : ''} d’accueil`}>
      <span aria-hidden="true">{places}</span>
    </Cue>
  )
}

function PartnerCue({ student }) {
  const condition = student.conditionType
  if (!condition || condition === 'none') return null
  const Icon = condition === 'different_only' ? Link2Off : condition === 'named_only' ? UserPlus : Link2
  const name = condition === 'named_only' ? student.namedPartner : student.regularCorrespondents
  return <Cue icon={Icon} tone="warning" label={[conditionLabels[condition], name].filter(Boolean).join(' · ')} />
}

function GenderMark({ gender }) {
  const label = genderLabel[gender] || genderLabel.unspecified
  return <span className={`gender-mark ${gender || 'unspecified'}`} role="img" aria-label={label} title={label}>{genderSymbol[gender] || genderSymbol.unspecified}</span>
}

function StudentRow({ student, decision, assigned, selected, inspected, onSelect }) {
  return (
    <button className={`student-row ${selected ? 'selected' : ''} ${inspected ? 'inspected' : ''} ${assigned ? 'assigned' : ''} ${decision === 'declined' ? 'inactive' : ''}`} onClick={() => onSelect(student)} aria-pressed={selected}>
      <span className="selection-box" aria-hidden="true">{selected ? <Check size={14} /> : assigned ? <Lock size={13} /> : null}</span>
      <span className="student-row-main">
        <span className="student-row-name"><GenderMark gender={student.gender} /><strong>{fullName(student)}</strong></span>
        <small className="school-name" data-school={student.school}>{schoolLabel(student.school)} · {student.className}</small>
        <span className="student-cues">
          <HostingCue student={student} />
          <PartnerCue student={student} />
          {!student.acceptsOtherGender && <Cue icon={UsersRound} tone="warning" label="Même sexe uniquement" />}
          {student.requiredRotation && <Cue icon={CalendarDays} tone={`block-${student.requiredRotation.toLowerCase()}`} label={`Bloc ${student.requiredRotation} indispensable`}>{student.requiredRotation}</Cue>}
          {decision === 'declined' && <Cue icon={CircleX} tone="unavailable" label="Échange refusé dans ce scénario" />}
          {student.status === 'review' && <Cue icon={AlertTriangle} tone="warning" label="Fiche à vérifier" />}
          <DiscussionBadge count={getMatchingComments(student).length} />
        </span>
      </span>
    </button>
  )
}

function StudentRail({ title, side, students, scenario, assigned, selectedIds, inspectedId, onSelect }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [school, setSchool] = useState('all')
  const [hosting, setHosting] = useState('all')
  const [gender, setGender] = useState('all')
  const [freePartner, setFreePartner] = useState(false)
  const [sameGenderOnly, setSameGenderOnly] = useState(false)
  const criterionCount = Number(hosting !== 'all') + Number(gender !== 'all') + Number(freePartner) + Number(sameGenderOnly)
  const items = students.filter((student) => {
    const matchText = `${fullName(student)} ${student.className}`.toLowerCase().includes(query.toLowerCase())
    const declined = !isMaintainedInScenario(student, scenario)
    const capacity = hostCapacity(student)
    const matchFilter = filter === 'all' || (filter === 'unassigned' ? !assigned.has(student.id) && !declined && student.participation !== 'host_only' : student.status === 'review' || student.otherInfo || student.notes || declined || !capacity)
    const matchSchool = school === 'all' || student.school === school
    const matchHosting = hosting === 'all' || (hosting === '0' ? capacity === 0 : capacity >= Number(hosting))
    return matchText && matchFilter && matchSchool && matchHosting
      && (gender === 'all' || student.gender === gender)
      && (!freePartner || student.conditionType === 'none')
      && (!sameGenderOnly || !student.acceptsOtherGender)
  })
  const grouped = groupByClass(items)
  return (
    <section className="student-rail">
      <header><h2>{title}</h2><select value={school} onChange={(event) => setSchool(event.target.value)} aria-label={`Filière de ${title}`}><option value="all">Toutes les filières</option>{side === 'bercher' ? <><option value="VP">VP · Bercher</option><option value="VG">VG · Bercher</option></> : <><option value="Bezirksschule">Bez · Brugg</option><option value="Sekundarschule">Sek · Brugg</option></>}</select></header>
      <label className="search-field"><Search size={16} aria-hidden="true" /><input type="search" aria-label={`Rechercher à ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" /></label>
      <div className="mini-tabs" role="group" aria-label={`État des élèves de ${title}`}>
        {[['all', 'Tous'], ['unassigned', 'À placer'], ['attention', 'Attention']].map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      <details className="rail-filters">
        <summary><ListFilter size={15} aria-hidden="true" /> Critères {criterionCount > 0 && <b>{criterionCount}</b>}</summary>
        <div role="group" aria-label={`Critères à ${title}`}>
          <label className="rail-select-filter">Accueil
            <select aria-label="Accueil" value={hosting} onChange={(event) => setHosting(event.target.value)}>
              <option value="all">Toutes capacités</option>
              <option value="0">Accueil impossible</option>
              <option value="1">Peut accueillir</option>
              <option value="2">Au moins 2 places</option>
            </select>
          </label>
          <label className="rail-select-filter">Genre
            <select aria-label="Genre" value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="all">Tous les genres</option>
              <option value="female">Filles</option>
              <option value="male">Garçons</option>
            </select>
          </label>
          <label><input type="checkbox" checked={freePartner} onChange={(event) => setFreePartner(event.target.checked)} /> Partenaire indifférent</label>
          <label><input type="checkbox" checked={sameGenderOnly} onChange={(event) => setSameGenderOnly(event.target.checked)} /> Même sexe uniquement</label>
        </div>
      </details>
      <div className="student-list">{grouped.map(([className, classStudents]) => <section className="rail-class-group" data-school={classStudents[0].school} key={className}><header><strong>{className}</strong><span>{classStudents.length}</span></header>{classStudents.map((student) => <StudentRow key={student.id} student={student} decision={getScenarioDecision(student, scenario)} assigned={assigned.has(student.id)} selected={selectedIds.has(student.id)} inspected={inspectedId === student.id} onSelect={onSelect} />)}</section>)}{!items.length && <p className="empty-note">Aucun élève dans ce filtre.</p>}</div>
      <footer>{items.length} élève{items.length > 1 ? 's' : ''} · {grouped.length} classe{grouped.length > 1 ? 's' : ''}</footer>
    </section>
  )
}

function UsualBadge({ status }) {
  const { Icon, text, hint } = usualBadges[status] || usualBadges.unknown
  return <span className={`usual-badge ${status || 'unknown'}`} title={hint}><Icon size={13} aria-hidden="true" />{text}</span>
}

function PairMember({ student, onInspect }) {
  return (
    <button type="button" className="pair-member" onClick={() => onInspect(student.id)}>
      <strong>{fullName(student)}</strong>
      <span className="pair-member-cues">
        <small className="school-badge" data-school={student.school}>{student.className || 'Sans classe'}</small>
        <HostingCue student={student} />
        <DiscussionBadge count={getMatchingComments(student).length} />
      </span>
    </button>
  )
}

function PairingCard({ pairing, students, evaluate, selected, onSelect, onInspectStudent, onDragStart, onDragEnd, onRemove, onDiscuss }) {
  const result = evaluate(pairing.memberIds, pairing.rotation)
  const inspectMember = (id) => onInspectStudent(id, pairing.id)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  const missing = pairing.memberIds.length - members.length
  const status = result.conflicts.length ? 'conflict' : result.warnings.length ? 'warning' : 'success'
  const hostShortages = Object.entries(result.hosting).filter(([, capacity]) => !capacity.sufficient)
  const hostHint = hostShortages.map(([side, { required, available }]) => `${side === 'bercher' ? 'Bercher' : 'Brugg'} : ${available} place${available === 1 ? '' : 's'} pour ${required} visiteur${required === 1 ? '' : 's'}`).join(' · ')
  const groupNames = members.map(fullName).join(', ')
  const commentCount = getMatchingComments(pairing).length
  const startDrag = (event) => {
    if (event.target.closest('.pairing-card-remove, .pairing-discussion-badge')) {
      event.preventDefault()
      return
    }
    onDragStart(event, pairing.id)
  }
  return (
    <article className={`pairing-card ${selected ? 'selected' : ''} ${status}`} draggable onDragStart={startDrag} onDragEnd={onDragEnd}>
      <header className="pairing-card-toolbar">
        <UsualBadge status={result.usualStatus} />
        <button type="button" className="pairing-card-heading" onClick={() => onSelect(pairing.id)} aria-label="Ouvrir les détails du groupe" title={pairing.locked ? 'Groupe validé' : 'Groupe à valider'}>
          {pairing.locked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button type="button" className="pairing-card-remove" aria-label={groupNames ? `Retirer le groupe de ${groupNames}` : 'Retirer le groupe'} title="Retirer le groupe" draggable={false} onClick={(event) => { event.stopPropagation(); onRemove(pairing.id) }}>
          <X size={15} aria-hidden="true" />
        </button>
      </header>
      <div className="pair-members">
        <div>{members.filter((student) => student.side === 'bercher').map((student) => <PairMember key={student.id} student={student} onInspect={inspectMember} />)}</div>
        <i aria-hidden="true" />
        <div>{members.filter((student) => student.side === 'brugg').map((student) => <PairMember key={student.id} student={student} onInspect={inspectMember} />)}{missing > 0 && <span className="missing-member"><strong>Élève introuvable</strong><small>À réparer</small></span>}</div>
      </div>
      <footer className="pairing-card-footer">
        <button type="button" className="pairing-card-status" onClick={() => onSelect(pairing.id)} aria-label={`Compatibilité : ${result.score}%`}>{status === 'success' ? <CheckCircle2 /> : <AlertTriangle />}<span>{result.score}%</span></button>
        {hostHint && <Cue icon={House} tone={members.length > 2 ? 'unavailable' : 'warning'} label={`Accueil insuffisant · ${hostHint}`} />}
        {commentCount > 0 && (
          <button type="button" className="pairing-discussion-badge" aria-label={`Commentaires et questions du groupe · ${groupNames || 'Groupe'}`} draggable={false} onClick={() => onDiscuss(pairing.id)}>
            <DiscussionBadge count={commentCount} />
          </button>
        )}
      </footer>
    </article>
  )
}

function InspectorDisclosure({ label, children }) {
  return (
    <details className="inspector-disclosure">
      <summary>{label}<ChevronDown size={15} aria-hidden="true" /></summary>
      {children}
    </details>
  )
}

function StudentProfileDetails({ student, students }) {
  const correspondent = getCorrespondentStatus(student, students)
  const requested = student.conditionType === 'named_only'
    ? findStudentByName(student.namedPartner, students, student.side === 'bercher' ? 'brugg' : 'bercher')
    : null
  const otherInfo = student.otherInfo || [student.animals, student.groupPreference, student.notes].filter(Boolean).join('\n')

  return (
    <InspectorDisclosure label="Informations de la fiche">
      <dl className="student-profile-details">
        <div>
          <dt>Correspondants habituels</dt>
          <dd>
            {correspondent.name || 'Non renseignés'}
            {correspondent.matches.length > 0 && <small>Retrouvés · {correspondent.matches.map(({ student: match, method }) => fullName(match) + (method === 'approximate' ? ' (nom proche)' : '')).join(', ')}</small>}
            {correspondent.candidates.length > 0 && <small>À préciser · {correspondent.candidates.map(fullName).join(', ')}</small>}
            {correspondent.missingNames.length > 0 && <small>Fiches introuvables · {correspondent.missingNames.join(', ')}</small>}
          </dd>
        </div>
        <div>
          <dt>Partenaire</dt>
          <dd>
            {conditionLabels[student.conditionType] || 'Libre'}
            {student.conditionType === 'named_only' && <small>{requested ? fullName(requested) : student.namedPartner || 'Nom à renseigner'}</small>}
          </dd>
        </div>
        <div><dt>Genre du partenaire</dt><dd>{student.acceptsOtherGender ? 'Autre sexe accepté' : 'Même sexe uniquement'}</dd></div>
        {otherInfo && <div><dt>Autres infos utiles</dt><dd>{otherInfo}</dd></div>}
      </dl>
    </InspectorDisclosure>
  )
}

function StudentInspector({ student, students, scenario, group, result, onClose, onDecisionChange, onEdit, onDiscuss }) {
  const places = hostCapacity(student)
  const participationLabel = student.participation === 'host_only'
    ? 'Accueil sans voyage'
    : places ? 'Voyage et accueil' : 'Voyage sans accueil'

  return (
    <aside className="pairing-inspector student-inspector" aria-label={'Fiche de ' + fullName(student)}>
      <header>
        <div>
          <h2>{fullName(student)}</h2>
          <small className="school-name" data-school={student.school}>{schoolLabel(student.school)} · {student.className || 'Sans classe'}</small>
        </div>
        <span className="student-inspector-actions">
          <button type="button" className="icon-button" onClick={() => onEdit(student.id)} aria-label="Modifier la fiche" title="Modifier la fiche"><Pencil size={16} /></button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button>
        </span>
      </header>
      <div className="student-inspector-summary">
        <GenderMark gender={student.gender} />
        <div>
          <strong>{participationLabel}</strong>
          <small>{places > 0 && (places === 1 ? '1 place d’accueil' : places + ' places d’accueil')}{places > 0 && student.requiredRotation ? ' · ' : ''}{student.requiredRotation && ('Bloc ' + student.requiredRotation + ' requis')}</small>
        </div>
      </div>
      {result && <GroupConditionSummary group={group} result={result} />}
      <DiscussionButton count={getMatchingComments(student).length} onClick={() => onDiscuss(student.id)} />
      <StudentProfileDetails student={student} students={students} />
      <label className="scenario-decision">
        <span>Maintien dans ce scénario</span>
        <select value={getScenarioDecision(student, scenario)} onChange={(event) => onDecisionChange(student, event.target.value)}>
          {Object.entries(scenarioDecisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </aside>
  )
}

const conditionStatuses = [
  { state: 'fail', title: 'Non respectées', label: 'non respectée', Icon: CircleX },
  { state: 'review', title: 'À vérifier', label: 'à vérifier', Icon: AlertTriangle },
  { state: 'pass', title: 'Respectées', label: 'respectée', Icon: CheckCircle2 },
]

function GroupConditionSummary({ group, result }) {
  const items = [...result.conditions.indispensable, ...result.conditions.optional]
  if (Object.values(result.hosting).every(({ sufficient }) => sufficient)) {
    items.push({ state: 'pass', label: 'Les places d’accueil sont suffisantes dans les deux écoles.' })
  }
  const groups = conditionStatuses.map((status) => ({
    ...status,
    items: items.filter(({ state }) => status.state === state),
  })).filter((status) => status.items.length)
  const firstIssue = groups.find(({ state }) => state !== 'pass')?.items[0]

  return (
    <section className="student-group-conditions" aria-label="Conditions dans le groupe">
      <header><h3>Dans ce groupe</h3><small>{group.rotation ? 'Bloc ' + group.rotation : 'Bloc à décider'}</small></header>
      <div className="condition-statuses">
        {groups.map(({ state, label, Icon, items: entries }) => (
          <span key={state} className={'condition-status ' + state}>
            <Icon size={14} aria-hidden="true" />{entries.length} {label}{state !== 'review' && entries.length > 1 ? 's' : ''}
          </span>
        ))}
      </div>
      {firstIssue && <p className={'group-leading-condition ' + firstIssue.state}>{firstIssue.label}</p>}
      <InspectorDisclosure label="Détail des conditions">
        {groups.map(({ state, title, items: entries, Icon }) => (
          <section className={'condition-detail ' + state} key={state}>
            <h4>{title}</h4>
            <ul>{entries.map(({ label }, index) => <li key={index}><Icon size={13} aria-hidden="true" /><span>{label}</span></li>)}</ul>
          </section>
        ))}
      </InspectorDisclosure>
    </section>
  )
}

function GroupInspector({ pairing, students, evaluate, scenarioId, onClose, onRemove, onRotate, onDiscuss }) {
  const { actions } = useWorkspace()
  const result = evaluate(pairing.memberIds, pairing.rotation)
  const canValidate = canConfirmPairing(result, pairing.rotation)
  const members = pairing.memberIds.map((id) => students.find((student) => student.id === id)).filter(Boolean)
  const hostClasses = (side) => [...new Set(members.filter((student) => student.side === side).map((student) => student.className).filter(Boolean))]
  const bercherClasses = hostClasses('bercher')
  const bruggClasses = hostClasses('brugg')
  const hostControl = (label, key, classes) => <label className="host-class-control">{label}<select value={pairing[key] || classes[0] || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { [key]: event.target.value })}>{classes.map((className) => <option key={className}>{className}</option>)}</select></label>

  return (
    <aside className="pairing-inspector group-inspector" aria-label="Informations du groupe">
      <header><h2>Groupe</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
      <p className="group-inspector-members">{members.map(fullName).join(' · ') || 'Élèves introuvables'}</p>
      <GroupConditionSummary group={pairing} result={result} />
      <DiscussionButton count={getMatchingComments(pairing).length} onClick={() => onDiscuss(pairing.id)} />
      <label className="rotation-control">Bloc du groupe<select value={pairing.rotation || ''} onChange={(event) => onRotate(pairing.id, event.target.value)}><option value="">À décider</option><option value="A">Bloc A</option><option value="B">Bloc B</option></select></label>
      <InspectorDisclosure label="Classes d’accueil et note de travail">
        <div className="host-class-grid">
          {hostControl('Classe d’accueil à Bercher', 'bercherHostClass', bercherClasses)}
          {hostControl('Classe d’accueil à Brugg', 'bruggHostClass', bruggClasses)}
          <label className="host-class-control">Note de travail<textarea rows="3" value={pairing.notes || ''} onChange={(event) => actions.updatePairing(scenarioId, pairing.id, { notes: event.target.value })} /></label>
        </div>
      </InspectorDisclosure>
      <div className="inspector-actions">
        <button className="primary-button" disabled={!canValidate && !pairing.locked} onClick={() => actions.updatePairing(scenarioId, pairing.id, { locked: !pairing.locked })}>{pairing.locked ? <Unlock size={17} /> : <Lock size={17} />}{pairing.locked ? 'Déverrouiller' : 'Valider le groupe'}</button>
        <button className="danger-button" onClick={() => onRemove(pairing.id)}><Trash2 size={17} /> Retirer</button>
      </div>
    </aside>
  )
}

function Inspector({ student, pairing, students, scenario, evaluate, onClose, onDecisionChange, onRemove, onRotate, onEditStudent, onDiscussStudent, onDiscussPairing }) {
  if (student) {
    const group = pairing || scenario.pairings.find(({ memberIds }) => memberIds.includes(student.id))
    const result = group ? evaluate(group.memberIds, group.rotation) : null
    return <StudentInspector key={student.id} student={student} students={students} scenario={scenario} group={group} result={result} onClose={onClose} onDecisionChange={onDecisionChange} onEdit={onEditStudent} onDiscuss={onDiscussStudent} />
  }
  if (pairing) return <GroupInspector key={pairing.id} pairing={pairing} students={students} evaluate={evaluate} scenarioId={scenario.id} onClose={onClose} onRemove={onRemove} onRotate={onRotate} onDiscuss={onDiscussPairing} />
  return null
}

function RotationBlock({ rotation, pairings, students, evaluate, selectedPairingId, onSelect, onInspectStudent, onRemove, onDiscuss, description, onDrop, onDragStart, onDragEnd, onDragHover, dropTarget }) {
  return (
    <section className={`rotation-block rotation-${rotation.toLowerCase()} ${dropTarget ? 'drop-target' : ''}`} onDragOver={(event) => { event.preventDefault(); onDragHover(rotation) }} onDrop={(event) => onDrop(event, rotation)}>
      <header><div><span>Bloc {rotation}</span><small>{description}</small></div><strong>{pairings.length} groupe{pairings.length > 1 ? 's' : ''}</strong></header>
      <div className="pairing-stack">{pairings.map((pairing) => <PairingCard key={pairing.id} pairing={pairing} students={students} evaluate={evaluate} selected={pairing.id === selectedPairingId} onSelect={onSelect} onInspectStudent={onInspectStudent} onRemove={onRemove} onDiscuss={onDiscuss} onDragStart={onDragStart} onDragEnd={onDragEnd} />)}{!pairings.length && <p className="empty-block">Déposez un groupe ici.</p>}</div>
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
        {[...groups.entries()].map(([school, rows]) => <tbody key={school}><tr className="balance-school-row" data-school={school}><th colSpan="7">{school}</th></tr>{rows.map((row) => <tr key={row.key}><th>{row.className}</th><td><BalanceValue value={row.first.outgoing} /></td><td><BalanceValue value={row.first.incoming} /></td><td><BalanceValue value={row.first.net} net /></td><td><BalanceValue value={row.second.outgoing} /></td><td><BalanceValue value={row.second.incoming} /></td><td><BalanceValue value={row.second.net} net /></td></tr>)}</tbody>)}
      </table></div>
      <footer>Solde = arrivées − départs. Une valeur négative signifie qu’il y aura moins d’élèves dans la classe.</footer>
    </section>
  )
}

export default function MatchingView() {
  const { workspace, actions, user } = useWorkspace()
  const scenario = workspace.scenarios.find((item) => item.id === workspace.activeScenarioId) || workspace.scenarios[0]
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [discussionTarget, setDiscussionTarget] = useState(null)
  const [selectedPairingId, setSelectedPairingId] = useState(null)
  const [newGroupRotation, setNewGroupRotation] = useState('A')
  const [draggedPairingId, setDraggedPairingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [suggestionMessage, setSuggestionMessage] = useState('')
  const [removedGroup, setRemovedGroup] = useState(null)
  const [reviewInput, setReviewInput] = useState(null)
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false)
  const assigned = useMemo(() => new Set(scenario?.pairings.flatMap((pairing) => pairing.memberIds) || []), [scenario])
  const evaluate = useMemo(() => createPairingEvaluator(workspace.students, scenario), [workspace.students, scenario])
  if (!scenario) return null
  const stats = scenarioStats(scenario, workspace.students, evaluate)
  const selectedPairing = scenario.pairings.find((pairing) => pairing.id === selectedPairingId)
  const selectedStudent = workspace.students.find((student) => student.id === selectedStudentId)
  const editingStudent = workspace.students.find((student) => student.id === editingStudentId)
  const discussionStudent = discussionTarget?.studentId
    ? workspace.students.find(({ id }) => id === discussionTarget.studentId)
    : null
  const discussionGroup = discussionTarget?.scenarioId === scenario.id
    ? scenario.pairings.find(({ id }) => id === discussionTarget.pairingId)
    : null
  const discussionEntity = discussionStudent || discussionGroup
  const discussStudent = (studentId) => setDiscussionTarget({ studentId })
  const discussPairing = (pairingId) => setDiscussionTarget({ scenarioId: scenario.id, pairingId })
  const selectStudent = (student) => {
    setSelectedStudentId(student.id)
    setSelectedPairingId(null)
    if (assigned.has(student.id) || student.participation === 'host_only' || !isMaintainedInScenario(student, scenario)) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(student.id)) next.delete(student.id)
      else next.add(student.id)
      return next
    })
  }
  const selectPairing = (id) => { setSelectedPairingId(id); setSelectedStudentId(null) }
  const inspectPairMember = (id, pairingId) => { setSelectedStudentId(id); setSelectedPairingId(pairingId) }
  const changeStudentDecision = (student, decision) => {
    if (decision === 'declined' && assigned.has(student.id)
      && !window.confirm(`Retirer ${fullName(student)} de son groupe dans « ${scenario.name} » ?`)) return
    actions.setScenarioStudentDecision(scenario.id, student, decision)
    if (decision === 'declined') {
      setSelectedIds((current) => { const next = new Set(current); next.delete(student.id); return next })
    }
  }
  const createGroup = () => {
    const members = [...selectedIds]
    if (!canAppendPairings(scenario, [{ memberIds: members }], workspace.students)) return
    const selectedStudents = members.map((id) => workspace.students.find((student) => student.id === id)).filter(Boolean)
    const pairingId = actions.addPairing(scenario.id, members, newGroupRotation, {
      bercherHostClass: selectedStudents.find((student) => student.side === 'bercher')?.className || '',
      bruggHostClass: selectedStudents.find((student) => student.side === 'brugg')?.className || '',
    })
    setSelectedIds(new Set())
    selectPairing(pairingId)
  }
  const applyReview = (pairings) => {
    if (reviewInput.scenario !== scenario || reviewInput.students !== workspace.students
      || !canAppendPairings(scenario, pairings, workspace.students, true)) {
      return 'Le scénario a changé. Rouvrez l’appairage automatique pour recalculer les propositions.'
    }
    actions.addPairings(scenario.id, pairings, reviewInput.scenario, reviewInput.students)
    setReviewInput(null)
    setRemovedGroup(null)
    setSelectedIds(new Set())
    setSelectedPairingId(null)
    setSelectedStudentId(null)
    setSuggestionMessage(`${pairings.length} ${pairings.length === 1 ? 'groupe validé' : 'groupes validés'}.`)
  }
  const removeGroup = (id) => {
    const index = scenario.pairings.findIndex((pairing) => pairing.id === id)
    if (index === -1) return
    setRemovedGroup({ scenarioId: scenario.id, pairing: scenario.pairings[index], index })
    actions.removePairing(scenario.id, id)
    if (selectedPairingId === id) setSelectedPairingId(null)
    setSuggestionMessage('Groupe retiré.')
  }
  const restoreGroup = () => {
    if (scenario.id !== removedGroup.scenarioId || !canAppendPairings(scenario, [removedGroup.pairing], workspace.students)) {
      setSuggestionMessage('Le groupe ne peut plus être rétabli. Vérifiez que ses élèves sont disponibles.')
    } else {
      actions.restorePairing(scenario.id, removedGroup.pairing, removedGroup.index)
      setSuggestionMessage('Groupe rétabli.')
    }
    setRemovedGroup(null)
  }
  const newScenario = () => setScenarioModalOpen(true)
  const canCreate = canAppendPairings(scenario, [{ memberIds: [...selectedIds] }], workspace.students)
  const blockA = scenario.pairings.filter((pairing) => pairing.rotation === 'A')
  const blockB = scenario.pairings.filter((pairing) => pairing.rotation === 'B')
  const undecided = scenario.pairings.filter((pairing) => !pairing.rotation)
  const rotatePairing = (id, rotation) => {
    const pairing = scenario.pairings.find((item) => item.id === id)
    if (!pairing || pairing.rotation === rotation) return
    const unlock = pairing.locked && !canConfirmPairing(evaluate(pairing.memberIds, rotation), rotation)
    actions.updatePairing(scenario.id, id, { rotation, ...(unlock ? { locked: false } : {}) })
  }
  const movePairing = (event, rotation) => {
    event.preventDefault()
    const pairingId = event.dataTransfer.getData('text/plain') || draggedPairingId
    if (pairingId) rotatePairing(pairingId, rotation)
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
        <h1>Appairages</h1>
        <div className="button-row"><button className="primary-button" onClick={() => setReviewInput({ scenario, students: workspace.students })}><Sparkles size={18} /> Appairage automatique</button><button className="secondary-button" onClick={newScenario}><Plus size={18} /> Nouveau scénario</button></div>
      </div>
      {suggestionMessage && <div className="suggestion-result"><span role="status">{suggestionMessage}</span>{removedGroup?.scenarioId === scenario.id && <button className="text-button" onClick={restoreGroup}>Annuler la suppression</button>}<button className="icon-button small" onClick={() => { setSuggestionMessage(''); setRemovedGroup(null) }} aria-label="Fermer le résultat"><X /></button></div>}
      <div className="scenario-tabs">{workspace.scenarios.map((item) => <button key={item.id} className={item.id === scenario.id ? 'active' : ''} aria-pressed={item.id === scenario.id} onClick={() => { actions.setActiveScenario(item.id); setSelectedPairingId(null); setSelectedStudentId(null); setSelectedIds(new Set()); setSuggestionMessage(''); setRemovedGroup(null) }}><span className="scenario-tab-copy"><strong>{item.name}</strong><small>{item.createdBy ? `Créé par ${item.createdBy}` : 'Créateur non indiqué'}</small></span>{item.status === 'validated' && <Lock size={13} />}</button>)}<button className="add-tab" onClick={newScenario} aria-label="Ajouter un scénario"><Plus /></button></div>
      <div className="stats-strip"><span><UsersRound /> <strong>{stats.assigned}</strong><small>appariés</small></span><span><CircleDashed /><strong>{stats.unassigned}</strong><small>à placer</small></span><span className={stats.alertCount ? 'warning' : ''}><AlertTriangle /><strong>{stats.alertCount}</strong><small>alertes</small></span><span><b>A</b><strong>{stats.groupA}</strong><small>groupes</small></span><span><b>B</b><strong>{stats.groupB}</strong><small>groupes</small></span></div>
      <div className="matching-workspace">
        <StudentRail title="Bercher" side="bercher" students={workspace.students.filter((student) => student.side === 'bercher')} scenario={scenario} assigned={assigned} selectedIds={selectedIds} inspectedId={selectedStudentId} onSelect={selectStudent} />
        <section className="pairing-canvas">
          <header><h2>Blocs d’échange</h2></header>
          <div className="rotation-block-grid">
            <RotationBlock rotation="A" pairings={blockA} students={workspace.students} evaluate={evaluate} selectedPairingId={selectedPairingId} onSelect={selectPairing} onInspectStudent={inspectPairMember} onRemove={removeGroup} onDiscuss={discussPairing} description="Bercher voyage d’abord" onDrop={movePairing} onDragStart={beginDrag} onDragEnd={() => { setDraggedPairingId(null); setDropTarget(null) }} onDragHover={setDropTarget} dropTarget={dropTarget === 'A'} />
            <RotationBlock rotation="B" pairings={blockB} students={workspace.students} evaluate={evaluate} selectedPairingId={selectedPairingId} onSelect={selectPairing} onInspectStudent={inspectPairMember} onRemove={removeGroup} onDiscuss={discussPairing} description="Brugg voyage d’abord" onDrop={movePairing} onDragStart={beginDrag} onDragEnd={() => { setDraggedPairingId(null); setDropTarget(null) }} onDragHover={setDropTarget} dropTarget={dropTarget === 'B'} />
            {!!undecided.length && <section className="rotation-block rotation-undecided"><header><div><span>À décider</span><small>Bloc encore non attribué</small></div><strong>{undecided.length} groupe{undecided.length > 1 ? 's' : ''}</strong></header><div className="pairing-stack">{undecided.map((pairing) => <PairingCard key={pairing.id} pairing={pairing} students={workspace.students} evaluate={evaluate} selected={pairing.id === selectedPairingId} onSelect={selectPairing} onInspectStudent={inspectPairMember} onRemove={removeGroup} onDiscuss={discussPairing} onDragStart={beginDrag} onDragEnd={() => { setDraggedPairingId(null); setDropTarget(null) }} />)}</div></section>}
          </div>
          <div className={`drop-zone ${canCreate ? 'ready' : ''}`}><UserPlus /><strong>{canCreate ? `Créer un groupe avec ${selectedIds.size} élèves` : 'Sélectionnez les élèves des deux écoles'}</strong><div className="new-group-controls"><span>Placer dans</span><button type="button" className={newGroupRotation === 'A' ? 'active' : ''} onClick={() => setNewGroupRotation('A')}>Bloc A</button><button type="button" className={newGroupRotation === 'B' ? 'active' : ''} onClick={() => setNewGroupRotation('B')}>Bloc B</button><button className="primary-button compact" disabled={!canCreate} onClick={createGroup}>Créer</button></div></div>
        </section>
        <StudentRail title="Brugg" side="brugg" students={workspace.students.filter((student) => student.side === 'brugg')} scenario={scenario} assigned={assigned} selectedIds={selectedIds} inspectedId={selectedStudentId} onSelect={selectStudent} />
        <Inspector student={selectedStudent} pairing={selectedPairing} students={workspace.students} scenario={scenario} evaluate={evaluate} onClose={() => { setSelectedStudentId(null); setSelectedPairingId(null) }} onDecisionChange={changeStudentDecision} onEditStudent={setEditingStudentId} onDiscussStudent={discussStudent} onDiscussPairing={discussPairing} onRemove={removeGroup} onRotate={rotatePairing} />
      </div>
      <ClassBalancePanel scenario={scenario} students={workspace.students} />
      {editingStudent && <StudentDrawer student={editingStudent} students={workspace.students} onClose={() => setEditingStudentId(null)} onSave={(student) => {
        actions.updateStudent(student)
        setEditingStudentId(null)
      }} />}
      {discussionEntity && (
        <MatchingDiscussion
          subject={discussionStudent ? fullName(discussionStudent) : discussionGroup.memberIds.map((id) => fullName(workspace.students.find((student) => student.id === id))).filter(Boolean).join(' · ') || 'Groupe'}
          comments={getMatchingComments(discussionEntity)}
          onAdd={(draft) => actions.addMatchingComment(discussionTarget, draft)}
          onClose={() => setDiscussionTarget(null)}
        />
      )}
      {reviewInput && <MatchingReviewModal students={reviewInput.students} scenario={reviewInput.scenario} onClose={() => setReviewInput(null)} onApply={applyReview} />}
      {scenarioModalOpen && <ScenarioModal initialName={`Proposition ${workspace.scenarios.length + 1}`} initialCreatedBy={accountLabel(user?.email)} onClose={() => setScenarioModalOpen(false)} onSave={({ name, createdBy }) => { actions.addScenario(name, createdBy); setScenarioModalOpen(false) }} />}
    </div>
  )
}
