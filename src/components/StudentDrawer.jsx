import { CheckCircle2, CircleDashed, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cannotHost, fullName, getCorrespondentStatus, hostCapacity, isStudentEnrollmentComplete } from '../lib/compatibility'

const participationOptions = [
  ['exchange_and_host', 'Participe et peut accueillir'],
  ['travel_no_host', 'Aimerait participer mais ne peut pas accueillir'],
  ['host_only', 'Ne veut pas aller mais peut accueillir'],
]

const conditionOptions = [
  ['none', 'Libre — sans exigence sur le partenaire'],
  ['regular_only', 'Un de ses correspondants habituels uniquement'],
  ['different_only', 'Aucun de ses correspondants habituels'],
  ['named_only', 'Une personne précise uniquement'],
]

export default function StudentDrawer({ student, students, onClose, onSave }) {
  const [draft, setDraft] = useState(student)
  useEffect(() => setDraft(student), [student])
  if (!draft) return null

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...draft, hostCapacity: hostCapacity(draft), status: isStudentEnrollmentComplete(draft) ? 'complete' : 'review' })
  }
  const { state, matches, candidates, missingNames } = getCorrespondentStatus(draft, students)
  const needsReview = candidates.length > 0 || missingNames.length > 0 || matches.some(({ method }) => method === 'approximate')
  const CorrespondentIcon = needsReview ? CircleDashed : CheckCircle2
  const hostingPossible = !cannotHost(draft)
  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Fermer la fiche" />
      <aside className="student-drawer" aria-label="Fiche élève">
        <header><h2>Fiche élève</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
        <form onSubmit={submit}>
          <section>
            <h3>Identité</h3>
            <div className="form-grid two-cols">
              <label className="span-two">Nom et prénom<input required value={draft.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="Nom et prénom de l’élève" /></label>
              <label>Établissement
                <select value={draft.school} onChange={(event) => { const school = event.target.value; update('school', school); update('side', ['VP', 'VG'].includes(school) ? 'bercher' : 'brugg') }}>
                  <option value="VP">VP · Bercher</option><option value="VG">VG · Bercher</option><option value="Bezirksschule">Bez · Brugg</option><option value="Sekundarschule">Sek · Brugg</option>
                </select>
              </label>
              <label>Classe<input required value={draft.className} onChange={(event) => update('className', event.target.value)} placeholder="11VP1 / 11VG1 / B1 / S1" /></label>
            </div>
            <fieldset className="inline-options"><legend>Genre</legend>
              {[['female', 'Fille'], ['male', 'Garçon']].map(([value, label]) => <label key={value}><input required type="radio" name="gender" checked={draft.gender === value} onChange={() => update('gender', value)} /> {label}</label>)}
            </fieldset>
          </section>

          <section className="correspondent-section">
            <label>Correspondants habituels
              <textarea rows="2" value={draft.regularCorrespondents ?? ''} onChange={(event) => update('regularCorrespondents', event.target.value)} aria-describedby="correspondents-help" placeholder="Nora Keller, Zoé Weber, Léa Müller" />
            </label>
            <p id="correspondents-help" className="field-help">Saisissez le prénom et le nom de chacun. Séparez les personnes par des virgules.</p>
            {state !== 'empty' && (
              <div className={`correspondent-state ${needsReview ? 'missing' : 'found'}`}>
                <CorrespondentIcon aria-hidden="true" />
                <span>
                  {matches.length > 0 && <strong>{matches.length} {matches.length === 1 ? 'correspondant reconnu' : 'correspondants reconnus'}</strong>}
                  {matches.map(({ student, method }) => <small key={student.id}>{[fullName(student), student.className, method === 'approximate' && 'Nom proche'].filter(Boolean).join(' · ')}</small>)}
                  {candidates.length > 0 && <small>Noms à préciser · {candidates.map(fullName).join(', ')}</small>}
                  {missingNames.length > 0 && <small>Fiches introuvables · {missingNames.join(', ')}</small>}
                </span>
              </div>
            )}
          </section>

          <section>
            <h3>Participation</h3>
            <div className="segmented three">
              {participationOptions.map(([value, label]) => <button type="button" key={value} className={draft.participation === value ? 'active' : ''} aria-pressed={draft.participation === value} onClick={() => setDraft((current) => ({
                ...current,
                participation: value,
                canHost: value !== 'travel_no_host',
                hostCapacity: value === 'travel_no_host' ? 0 : hostCapacity(current) || 1,
              }))}>{label}</button>)}
            </div>
            <label>Nombre maximal de correspondants à héberger
              <input
                type="number"
                min="1"
                max={Number.MAX_SAFE_INTEGER}
                step="1"
                required={hostingPossible}
                disabled={!hostingPossible}
                value={hostingPossible ? draft.hostCapacity ?? 1 : 0}
                onChange={(event) => update('hostCapacity', event.target.value)}
                aria-describedby="hosting-capacity-help"
              />
            </label>
            <p id="hosting-capacity-help" className="field-help">Indiquez combien d’élèves la famille peut héberger en même temps.</p>
            <p className="field-help">Les élèves qui ne voyagent pas peuvent tout de même être enregistrés comme accueillants.</p>
          </section>

          <section>
            <h3>Condition d’appairage</h3>
            <div className="radio-list">
              {conditionOptions.map(([value, label]) => <label key={value}><input type="radio" name="condition" checked={draft.conditionType === value} onChange={() => update('conditionType', value)} /> {label}</label>)}
            </div>
            {draft.conditionType === 'named_only' && <label>Personne demandée<input value={draft.namedPartner} onChange={(event) => update('namedPartner', event.target.value)} placeholder="Prénom et nom de l’élève de l’autre école" /></label>}
          </section>

          <section>
            <h3>Organisation</h3>
            <div className="form-grid two-cols">
              <label className="toggle-label"><input type="checkbox" checked={draft.acceptsOtherGender} onChange={(event) => update('acceptsOtherGender', event.target.checked)} /> Partenaire d’un autre sexe accepté</label>
              <label className="toggle-label"><input type="checkbox" checked={Boolean(draft.requiredRotation)} onChange={(event) => update('requiredRotation', event.target.checked ? 'A' : '')} /> Condition indispensable de groupe</label>
            </div>
            {draft.requiredRotation && <label>Ne peut participer que dans le groupe<select value={draft.requiredRotation} onChange={(event) => update('requiredRotation', event.target.value)}><option value="A">A</option><option value="B">B</option></select></label>}
            <p className="field-help">En règle générale, les élèves ne choisissent pas leur groupe. Cochez uniquement si leur participation dépend du groupe A ou B.</p>
          </section>

          <section>
            <h3>Autres infos utiles</h3>
            <label>Autres infos utiles<textarea rows="5" value={draft.otherInfo ?? draft.notes ?? ''} onChange={(event) => update('otherInfo', event.target.value)} placeholder="Allergies, animaux, souhaits, craintes, informations de placement…" /></label>
          </section>

          <section>
            <h3>Coordonnées à partager après validation</h3>
            <div className="form-grid two-cols">
              <label>N° de l’élève<input value={draft.studentPhone} onChange={(event) => update('studentPhone', event.target.value)} /></label>
              <label>N° des parents<input value={draft.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} /></label>
            </div>
            <label>Adresse<input value={draft.address} onChange={(event) => update('address', event.target.value)} placeholder="Rue et numéro" /></label>
            <label>Domicile<input value={draft.domicile || ''} onChange={(event) => update('domicile', event.target.value)} placeholder="Village / commune" /></label>
          </section>

          <footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button">Enregistrer</button></footer>
        </form>
      </aside>
    </div>
  )
}
