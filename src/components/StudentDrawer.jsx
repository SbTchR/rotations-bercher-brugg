import { CheckCircle2, CircleDashed, LockKeyhole, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fullName, getCorrespondentStatus } from '../lib/compatibility'

const participationOptions = [
  ['exchange_and_host', 'Participe et peut accueillir'],
  ['travel_no_host', 'Participe — accueil impossible'],
]

const conditionOptions = [
  ['none', 'Libre — sans exigence sur le partenaire'],
  ['regular_only', 'Son correspondant actuel uniquement'],
  ['different_only', 'Une autre personne que son correspondant'],
  ['named_only', 'Une personne précise uniquement'],
]

export default function StudentDrawer({ student, students, onClose, onSave }) {
  const [draft, setDraft] = useState(student)
  useEffect(() => setDraft(student), [student])
  if (!draft) return null

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    const complete = draft.firstName && draft.lastName && draft.school && draft.className
      && (draft.conditionType !== 'named_only' || draft.namedPartner)
      && (draft.conditionType !== 'different_only' || draft.regularCorrespondents)
    onSave({ ...draft, status: complete ? 'complete' : 'review' })
  }
  const correspondent = getCorrespondentStatus(draft, students)
  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Fermer la fiche" />
      <aside className="student-drawer" aria-label="Fiche élève">
        <header><h2>Fiche élève</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></header>
        <form onSubmit={submit}>
          <section>
            <h3>Identité</h3>
            <div className="form-grid two-cols">
              <label>Prénom<input required value={draft.firstName} onChange={(event) => update('firstName', event.target.value)} /></label>
              <label>Nom<input required value={draft.lastName} onChange={(event) => update('lastName', event.target.value)} /></label>
              <label>Établissement
                <select value={draft.school} onChange={(event) => { const school = event.target.value; update('school', school); update('side', school === 'Bercher' ? 'bercher' : 'brugg') }}>
                  <option>Bercher</option><option>Bezirksschule</option><option>Sekundarschule</option>
                </select>
              </label>
              <label>Classe<input required value={draft.className} onChange={(event) => update('className', event.target.value)} placeholder="11VG1 / B3a / S3b" /></label>
            </div>
            <fieldset className="inline-options"><legend>Genre</legend>
              {[['female', 'Fille'], ['male', 'Garçon'], ['unspecified', 'Non renseigné']].map(([value, label]) => <label key={value}><input type="radio" name="gender" checked={draft.gender === value} onChange={() => update('gender', value)} /> {label}</label>)}
            </fieldset>
          </section>

          <section className="correspondent-section">
            <h3>Correspondant actuel</h3>
            <label>Nom du correspondant<input value={draft.regularCorrespondents} onChange={(event) => update('regularCorrespondents', event.target.value)} placeholder="Prénom et nom" /></label>
            {correspondent.state === 'found' ? (
              <div className="correspondent-state found"><CheckCircle2 /><span><strong>Déjà ajouté dans l’application</strong><small>{fullName(correspondent.student)} · {correspondent.student.className}</small></span></div>
            ) : correspondent.state === 'missing' ? (
              <div className="correspondent-state missing"><CircleDashed /><span><strong>Pas encore ajouté</strong><small>Cette personne ne participe peut-être pas à l’échange.</small></span></div>
            ) : (
              <div className="correspondent-state empty"><CircleDashed /><span><strong>Aucun nom renseigné</strong><small>Vous pourrez le compléter plus tard.</small></span></div>
            )}
          </section>

          <section>
            <h3>Participation</h3>
            <div className="segmented two">
              {participationOptions.map(([value, label]) => <button type="button" key={value} className={draft.participation === value ? 'active' : ''} onClick={() => setDraft((current) => ({
                ...current,
                participation: value,
                canHost: value === 'exchange_and_host',
              }))}>{label}</button>)}
            </div>
            <p className="field-help">Seuls les élèves qui participent à l’échange sont ajoutés ici. La possibilité d’accueillir reste une information et ne bloque jamais un appairage.</p>
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
              <label>Rotation
                <select value={draft.rotation} onChange={(event) => update('rotation', event.target.value)}><option value="">À décider</option><option value="A">A</option><option value="B">B</option></select>
              </label>
            </div>
          </section>

          <section>
            <h3>Contraintes utiles</h3>
            <label>Animaux à domicile<input value={draft.animals} onChange={(event) => update('animals', event.target.value)} placeholder="Aucun, chats, chien…" /></label>
            <label>Préférence de groupe<input value={draft.groupPreference} onChange={(event) => update('groupPreference', event.target.value)} placeholder="Souhaite être avec…" /></label>
            <label>Commentaires confidentiels<textarea rows="4" value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Allergies, santé, craintes, informations de placement…" /></label>
            <div className="privacy-note"><LockKeyhole size={16} /> Visible uniquement par les responsables autorisés.</div>
          </section>

          <section>
            <h3>Coordonnées à partager après validation</h3>
            <div className="form-grid two-cols">
              <label>N° de l’élève<input value={draft.studentPhone} onChange={(event) => update('studentPhone', event.target.value)} /></label>
              <label>N° des parents<input value={draft.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} /></label>
            </div>
            <label>Adresse complète<input value={draft.address} onChange={(event) => update('address', event.target.value)} /></label>
            <label className="toggle-label"><input type="checkbox" checked={draft.sharePhones} onChange={(event) => update('sharePhones', event.target.checked)} /> Autorisation de partager les numéros avec les familles participantes</label>
          </section>

          <footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button">Enregistrer</button></footer>
        </form>
      </aside>
    </div>
  )
}
