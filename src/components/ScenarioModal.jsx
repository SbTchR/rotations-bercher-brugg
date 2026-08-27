import { FilePenLine, X } from 'lucide-react'
import { useState } from 'react'

export default function ScenarioModal({ title = 'Nouveau scénario', initialName = '', initialCreatedBy = '', onClose, onSave }) {
  const [name, setName] = useState(initialName)
  const [createdBy, setCreatedBy] = useState(initialCreatedBy)

  const submit = (event) => {
    event.preventDefault()
    if (!name.trim() || !createdBy.trim()) return
    onSave({ name: name.trim(), createdBy: createdBy.trim() })
  }

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Fermer" />
      <section className="modal-card scenario-modal" aria-label={title}>
        <header><FilePenLine /><div><h2>{title}</h2><p>Cette indication permet à l’équipe de savoir qui a créé chaque proposition.</p></div><button className="icon-button small" onClick={onClose} aria-label="Fermer"><X /></button></header>
        <form onSubmit={submit}>
          <label>Nom du scénario<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Proposition 3" /></label>
          <label>Créé par<input required value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} placeholder="Nom ou identifiant de la responsable" /></label>
          <footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button">Créer le scénario</button></footer>
        </form>
      </section>
    </div>
  )
}
