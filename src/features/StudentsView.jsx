import { AlertTriangle, Check, ChevronRight, FileDown, FileSpreadsheet, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import StudentDrawer from '../components/StudentDrawer'
import { useWorkspace } from '../context/WorkspaceContext'
import { blankStudent } from '../data/demoData'
import { fullName, getCorrespondentStatus, schoolLabel } from '../lib/compatibility'

const participationLabel = {
  exchange_and_host: 'Accueil possible',
  travel_no_host: 'Participe — accueil impossible',
  host_only: 'N’accueille que des visiteurs',
}

const naturalCompare = (left, right) => left.localeCompare(right, 'fr-CH', { numeric: true, sensitivity: 'base' })

export default function StudentsView() {
  const { workspace, actions } = useWorkspace()
  const [school, setSchool] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [importState, setImportState] = useState(null)
  const fileRef = useRef(null)

  const filtered = useMemo(() => workspace.students.filter((student) => {
    const text = `${fullName(student)} ${student.className} ${schoolLabel(student.school)}`.toLowerCase()
    return (school === 'all' || student.school === school)
      && (status === 'all' || student.status === status)
      && text.includes(query.toLowerCase())
  }), [workspace.students, school, status, query])

  const selected = workspace.students.find((student) => student.id === selectedId)
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
  const deleteSelected = () => {
    if (!selected) return
    actions.removeStudent(selected.id)
    setSelectedId(null)
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
        <div className="filter-tabs" role="tablist">
          {[['all', 'Tous'], ['VP', 'VP · Bercher'], ['VG', 'VG · Bercher'], ['Bezirksschule', 'Bez · Brugg'], ['Sekundarschule', 'Sek · Brugg']].map(([value, label]) => (
            <button key={value} className={school === value ? 'active' : ''} onClick={() => setSchool(value)}>{label}</button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un élève…" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par état"><option value="all">Tous les états</option><option value="complete">Complets</option><option value="review">À vérifier</option></select>
          <button className="secondary-button compact" onClick={async () => { const { exportStudentsXlsx } = await import('../lib/importExport'); exportStudentsXlsx(workspace) }}><FileDown size={17} /> Exporter</button>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th aria-label="Sélection" /><th>Élève</th><th>Établissement</th><th>Classe</th><th>Correspondant</th><th>Accueil</th><th>Condition</th><th>Rotation</th><th>État</th><th /></tr></thead>
            <tbody>
              {grouped.flatMap((group) => [
                <tr className="class-group-row" key={`${group.key}-heading`}><td colSpan="10"><strong>{group.className}</strong><span>{schoolLabel(group.school)} · {group.students.length} élève{group.students.length > 1 ? 's' : ''}</span></td></tr>,
                ...group.students.map((student) => {
                  const correspondent = getCorrespondentStatus(student, workspace.students)
                  return <tr key={student.id} className={selectedId === student.id ? 'selected' : ''} onClick={() => setSelectedId(student.id)}>
                    <td><input type="radio" name="selected-student" checked={selectedId === student.id} onChange={() => setSelectedId(student.id)} aria-label={`Sélectionner ${fullName(student)}`} /></td>
                    <td><strong>{fullName(student)}</strong>{student.legacyImport && <small>Import ancien format</small>}</td>
                    <td>{schoolLabel(student.school)}</td><td>{student.className}</td>
                    <td><span className={`correspondent-chip ${correspondent.state}`}>{correspondent.state === 'found' ? <Check size={13} /> : correspondent.state === 'missing' ? <AlertTriangle size={13} /> : null}{correspondent.state === 'found' ? fullName(correspondent.student) : correspondent.state === 'missing' ? `${correspondent.name} · non ajouté` : 'Non renseigné'}</span></td>
                    <td className={student.participation === 'travel_no_host' ? 'danger-text' : ''}>{participationLabel[student.participation] || (student.canHost ? 'Possible' : 'Impossible')}</td>
                    <td>{student.conditionType === 'none' ? 'Libre' : student.conditionType === 'regular_only' ? 'son correspondant' : student.conditionType === 'different_only' ? 'autre personne' : 'personne précise'}</td>
                    <td>{student.rotation || '—'}</td>
                    <td><span className={`status-label ${student.status === 'complete' ? 'success' : 'warning'}`}>{student.status === 'complete' ? <Check size={14} /> : <AlertTriangle size={14} />}{student.status === 'complete' ? 'Complet' : 'À vérifier'}</span></td>
                    <td><button className="icon-button small" onClick={(event) => { event.stopPropagation(); setDraft(student) }} aria-label="Modifier"><ChevronRight /></button></td>
                  </tr>
                }),
              ])}
            </tbody>
          </table>
        </div>
        {selected && <div className="selection-bar"><span><Check size={16} /> 1 sélectionné</span><button onClick={() => setDraft(selected)}>Modifier</button><button className="danger-text" onClick={deleteSelected}><Trash2 size={16} /> Supprimer</button><button className="icon-button small" onClick={() => setSelectedId(null)} aria-label="Annuler la sélection"><X /></button></div>}
        <footer className="table-summary"><span>{workspace.students.length} participants</span><span>{workspace.students.filter((student) => getCorrespondentStatus(student, workspace.students).state === 'found').length} correspondants ajoutés</span><span>{workspace.students.filter((student) => getCorrespondentStatus(student, workspace.students).state === 'missing').length} non ajoutés</span><span>{workspace.students.filter((student) => !student.canHost).length} accueils impossibles</span></footer>
      </section>

      {draft && <StudentDrawer student={draft} students={workspace.students} onClose={() => setDraft(null)} onSave={saveStudent} />}
      {importState && <div className="modal-layer"><button className="modal-backdrop" onClick={() => setImportState(null)} aria-label="Fermer" /><section className="modal-card">
        <header><FileSpreadsheet /><div><h2>Importer le classeur</h2><p>{importState.filename}</p></div></header>
        {importState.error ? <div className="error-box">{importState.error}</div> : <>
          <p><strong>{importState.count} élèves</strong> ont été reconnus et <strong>{importState.pairings} appairages exacts</strong> ont pu être récupérés automatiquement.</p>
          <div className="warning-box"><AlertTriangle /> L’import remplacera les données actuelles. Les remarques libres ne sont jamais interprétées automatiquement et toutes les fiches importées seront marquées « À vérifier ». Vous pourrez annuler juste après avec la flèche Annuler.</div>
        </>}
        <footer><button className="secondary-button" onClick={() => setImportState(null)}>Annuler</button>{!importState.error && <button className="primary-button" onClick={() => { actions.replaceWorkspace(importState.next, `Import du fichier ${importState.filename}`); setImportState(null) }}>Importer et vérifier</button>}</footer>
      </section></div>}
    </div>
  )
}
