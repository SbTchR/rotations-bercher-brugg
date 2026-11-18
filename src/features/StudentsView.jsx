import { AlertTriangle, Check, ChevronRight, FileDown, FileSpreadsheet, House, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import StudentDrawer from '../components/StudentDrawer'
import { useWorkspace } from '../context/WorkspaceContext'
import { blankStudent } from '../data/demoData'
import { cannotHost, createNameResolver, fullName, getCorrespondentStatus, isStudentEnrollmentComplete, schoolLabel } from '../lib/compatibility'

const schools = ['all', 'VP', 'VG', 'Bezirksschule', 'Sekundarschule']
const conditions = {
  none: 'Libre',
  regular_only: 'Son correspondant',
  different_only: 'Autre personne',
}

function CorrespondentCell({ correspondent }) {
  if (correspondent.state === 'empty') return <span className="correspondent-chip empty">Non renseigné</span>

  const found = correspondent.state === 'found'
  const approximate = correspondent.matches.some((match) => match.method === 'approximate')
  const ambiguous = correspondent.candidates.length > 0
  const Icon = found && !approximate && !ambiguous ? Check : AlertTriangle

  return (
    <span className={`correspondent-chip ${ambiguous ? 'ambiguous' : approximate ? 'approximate' : correspondent.state}`}>
      <Icon size={14} aria-hidden="true" />
      <span>
        {found ? correspondent.matches.map(({ student }) => fullName(student)).join(', ') : correspondent.name}
        {(approximate || (found && ambiguous)) && <small>Saisi : {correspondent.name}</small>}
        {approximate && <small>Nom proche reconnu</small>}
        {ambiguous && <small>Plusieurs noms proches</small>}
        {!found && !ambiguous && <small>Pas encore ajouté</small>}
      </span>
    </span>
  )
}

function HostingCell({ student }) {
  const onlyHosts = student.participation === 'host_only'
  const noHosting = cannotHost(student)
  const Icon = noHosting && !onlyHosts ? AlertTriangle : House

  return (
    <span className={`status-label ${onlyHosts ? 'info' : noHosting ? 'warning' : 'success'}`}>
      <Icon size={14} aria-hidden="true" />
      {onlyHosts ? 'Accueille sans voyager' : noHosting ? 'Voyage sans accueillir' : 'Accueil possible'}
    </span>
  )
}

const naturalCompare = (left, right) => left.localeCompare(right, 'fr-CH', { numeric: true, sensitivity: 'base' })

export default function StudentsView() {
  const { workspace, actions } = useWorkspace()
  const [school, setSchool] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [draft, setDraft] = useState(null)
  const [importState, setImportState] = useState(null)
  const fileRef = useRef(null)
  const inscriptions = useMemo(() => {
    const students = workspace.students
    const resolveName = createNameResolver(students)
    const entries = new Map()
    let incomplete = 0
    let recognized = 0
    let withoutHosting = 0
    for (const student of students) {
      const complete = isStudentEnrollmentComplete(student)
      const correspondent = getCorrespondentStatus(student, students, resolveName)
      if (!complete) incomplete += 1
      if (correspondent.state === 'found') recognized += 1
      if (cannotHost(student)) withoutHosting += 1
      entries.set(student.id, { complete, correspondent })
    }
    return { entries, incomplete, recognized, withoutHosting }
  }, [workspace.students])

  const filtered = useMemo(() => workspace.students.filter((student) => {
    const text = `${fullName(student)} ${student.className} ${schoolLabel(student.school)}`.toLowerCase()
    return (school === 'all' || student.school === school)
      && (status === 'all' || (inscriptions.entries.get(student.id).complete ? status === 'complete' : status === 'review'))
      && text.includes(query.toLowerCase())
  }), [workspace.students, inscriptions, school, status, query])

  const selected = useMemo(() => workspace.students.filter((student) => selectedIds.has(student.id)), [workspace.students, selectedIds])
  const selectedOne = selected.length === 1 ? selected[0] : null
  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.has(student.id))
  const grouped = useMemo(() => {
    const groups = new Map()
    for (const student of filtered) {
      const key = `${student.school}|${student.className || 'Sans classe'}`
      if (!groups.has(key)) groups.set(key, { key, school: student.school, className: student.className || 'Sans classe', students: [] })
      groups.get(key).students.push(student)
    }
    return [...groups.values()].sort((left, right) => naturalCompare(left.school, right.school) || naturalCompare(left.className, right.className))
  }, [filtered])
  const chooseImport = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const { importLegacyWorkbook } = await import('../lib/importExport')
      const next = await importLegacyWorkbook(file, workspace)
      setImportState({ next, count: next.students.length, pairings: next.scenarios[0]?.pairings.length || 0, filename: file.name })
    } catch (error) {
      setImportState({ error: error.message, filename: file.name })
    }
  }
  const saveStudent = (student) => {
    if (workspace.students.some((item) => item.id === student.id)) actions.updateStudent(student)
    else actions.addStudent(student)
    setDraft(null)
  }
  const toggleSelection = (id) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleVisibleSelection = () => setSelectedIds((current) => {
    const next = new Set(current)
    if (allVisibleSelected) filtered.forEach((student) => next.delete(student.id))
    else filtered.forEach((student) => next.add(student.id))
    return next
  })
  const deleteSelected = () => {
    if (!selected.length) return
    const wording = selected.length === 1 ? `Supprimer la fiche de ${fullName(selected[0])} ?` : `Supprimer les ${selected.length} fiches sélectionnées ?`
    if (!window.confirm(`${wording}\n\nLes élèves seront aussi retirés des groupes où ils figurent. Cette action pourra être annulée.`)) return
    actions.removeStudents(selected.map((student) => student.id))
    setSelectedIds(new Set())
  }

  return (
    <div className="view students-view">
      <div className="view-heading">
        <div><h1>Inscriptions</h1><p>Saisissez les réponses des bulletins ou importez le fichier de chaque établissement.</p></div>
        <div className="button-row">
          <button className="primary-button" onClick={() => setDraft(blankStudent('bercher'))}><Plus size={18} /> Ajouter un élève</button>
          <button className="secondary-button" onClick={() => fileRef.current?.click()}><FileSpreadsheet size={18} /> Importer Excel</button>
          <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={chooseImport} />
        </div>
      </div>

      <section className="table-surface">
        <div className="filter-tabs" role="group" aria-label="Filtrer par filière">
          {schools.map((value) => (
            <button key={value} data-school={value} aria-pressed={school === value} className={school === value ? 'active' : ''} onClick={() => setSchool(value)}>
              {value !== 'all' && <span className="school-dot" aria-hidden="true" />}
              {value === 'all' ? 'Toutes' : schoolLabel(value)}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-field"><Search size={17} /><input type="search" aria-label="Rechercher un élève" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un élève…" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par état de la fiche"><option value="all">Tous les états</option><option value="complete">Fiches complètes</option><option value="review">Fiches à vérifier</option></select>
          <button className="secondary-button compact" onClick={async () => { const { exportStudentsXlsx } = await import('../lib/importExport'); exportStudentsXlsx(workspace) }}><FileDown size={17} /> Exporter</button>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table" role="table" aria-label="Inscriptions des élèves">
            <thead role="rowgroup"><tr role="row">
              <th scope="col" role="columnheader"><label className="select-visible"><input type="checkbox" checked={allVisibleSelected} disabled={!filtered.length} onChange={toggleVisibleSelection} aria-label="Sélectionner tous les élèves affichés" /><span>Sélectionner les élèves affichés</span></label></th>
              {['Élève', 'Filière', 'Classe', 'Correspondant', 'Accueil', 'Condition', 'Groupe', 'État de la fiche'].map((label) => <th key={label} className="student-column-heading" scope="col" role="columnheader">{label}</th>)}
              <th className="student-column-heading" scope="col" role="columnheader" aria-label="Modifier la fiche" />
            </tr></thead>
            {grouped.map((group) => (
              <tbody key={group.key} role="rowgroup">
                <tr className="class-group-row" data-school={group.school} role="row">
                  <th scope="rowgroup" role="rowheader" colSpan={10}>
                    <strong>{group.className}</strong>
                    <span>{schoolLabel(group.school)} · {group.students.length} élève{group.students.length > 1 ? 's' : ''}</span>
                  </th>
                </tr>
                {group.students.map((student) => {
                  const { correspondent, complete } = inscriptions.entries.get(student.id)
                  const name = fullName(student)
                  return (
                    <tr key={student.id} role="row" className={`student-table-row ${selectedIds.has(student.id) ? 'selected' : ''}`} onClick={() => toggleSelection(student.id)}>
                      <td className="student-table-select" role="cell"><input type="checkbox" checked={selectedIds.has(student.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelection(student.id)} aria-label={`Sélectionner ${name}`} /></td>
                      <th className="student-table-name" scope="row" role="rowheader"><strong>{name}</strong>{student.legacyImport && <small>Import ancien format</small>}</th>
                      <td className="student-table-school" data-label="Filière" role="cell"><span className="school-badge" data-school={student.school}>{schoolLabel(student.school)}</span></td>
                      <td className="student-table-class" data-label="Classe" role="cell">{student.className || '—'}</td>
                      <td className="student-table-correspondent" data-label="Correspondant" role="cell"><CorrespondentCell correspondent={correspondent} /></td>
                      <td data-label="Accueil" role="cell"><HostingCell student={student} /></td>
                      <td data-label="Condition" role="cell">{conditions[student.conditionType] || 'Personne précise'}</td>
                      <td data-label="Groupe" role="cell">{student.requiredRotation ? <span className="rotation-badge" data-rotation={student.requiredRotation}>Seulement {student.requiredRotation}</span> : '—'}</td>
                      <td data-label="État de la fiche" role="cell"><span className={`status-label ${complete ? 'success' : 'warning'}`}>{complete ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}{complete ? 'Complet' : 'À vérifier'}</span></td>
                      <td className="student-table-edit" role="cell"><button className="icon-button small" onClick={(event) => { event.stopPropagation(); setDraft(student) }} aria-label={`Modifier la fiche de ${name}`}><ChevronRight /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
          {!filtered.length && <p className="table-empty">Aucune inscription ne correspond aux filtres.</p>}
        </div>
        {!!selected.length && <div className="selection-bar"><span><Check size={16} /> {selected.length} sélectionné{selected.length > 1 ? 's' : ''}</span>{selectedOne && <button onClick={() => setDraft(selectedOne)}>Modifier</button>}<button className="danger-text" onClick={deleteSelected}><Trash2 size={16} /> Supprimer</button><button className="icon-button small" onClick={() => setSelectedIds(new Set())} aria-label="Annuler la sélection"><X /></button></div>}
        <footer className="table-summary">
          <span>{workspace.students.length} inscriptions</span>
          <span><Check size={15} aria-hidden="true" /> {inscriptions.recognized} correspondants retrouvés</span>
          <span><AlertTriangle size={15} aria-hidden="true" /> {inscriptions.incomplete} fiches à vérifier</span>
          <span><House size={15} aria-hidden="true" /> {inscriptions.withoutHosting} accueils impossibles</span>
        </footer>
      </section>

      {draft && <StudentDrawer student={draft} students={workspace.students} onClose={() => setDraft(null)} onSave={saveStudent} />}
      {importState && <div className="modal-layer"><button className="modal-backdrop" onClick={() => setImportState(null)} aria-label="Fermer" /><section className="modal-card">
        <header><FileSpreadsheet /><div><h2>Importer le classeur</h2><p>{importState.filename}</p></div></header>
        {importState.error ? <div className="error-box">{importState.error}</div> : <>
          <p><strong>{importState.count} élèves</strong> ont été reconnus. {importState.pairings ? <><strong>{importState.pairings} appairages</strong> de l’ancien classeur seront également récupérés.</> : 'Les élèves seront prêts à être appariés dans un nouveau scénario.'}</p>
          <div className="warning-box"><AlertTriangle /> L’import remplacera les données actuelles. Le nouveau format conserve les conditions détaillées ; les anciens classeurs restent importables mais leurs fiches devront être contrôlées. Vous pourrez annuler juste après avec la flèche Annuler.</div>
        </>}
        <footer><button className="secondary-button" onClick={() => setImportState(null)}>Annuler</button>{!importState.error && <button className="primary-button" onClick={() => { actions.replaceWorkspace(importState.next, `Import du fichier ${importState.filename}`); setImportState(null) }}>Importer et vérifier</button>}</footer>
      </section></div>}
    </div>
  )
}
