import { AlertTriangle, ArrowRight, Check, ChevronDown, CircleDashed, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fullName } from '../lib/compatibility'
import { computeProvisionalPlan } from '../lib/matchingAlgorithm'
import './matchingReview.css'

const plural = (count, one, several) => count === 1 ? one : several
const pairingKey = (pairing) => `${pairing.memberIds.join('/')}/${pairing.rotation}`

function Criteria({ result }) {
  return (
    <div className="review-criteria-group">
      {result.respected.length > 0 && (
        <details className="review-positive">
          <summary><Check size={16} aria-hidden="true" /> {result.respected.length} {plural(result.respected.length, 'critère respecté', 'critères respectés')} <ChevronDown size={14} className="review-chevron" aria-hidden="true" /></summary>
          <ul className="review-criteria">
            {result.respected.map((label) => <li key={label} className="criteria-pass"><Check aria-hidden="true" /><span>{label}</span></li>)}
          </ul>
        </details>
      )}
      {(result.warnings.length > 0 || result.conflicts.length > 0) && (
        <ul className="review-criteria">
          {result.warnings.map((label) => <li key={label} className="criteria-warning"><AlertTriangle aria-hidden="true" /><span>{label}</span></li>)}
          {result.conflicts.map((label) => <li key={label} className="criteria-conflict"><X aria-hidden="true" /><span>{label}</span></li>)}
        </ul>
      )}
    </div>
  )
}

const optionLabel = { ordinary: 'Binôme', trio: 'Groupe à trois', blocked: 'Proposition bloquée' }

function ReviewOption({ option, preferred, names, studentId, onChoose }) {
  const { pairing, impact, reason, selectable, kind } = option
  const reciprocalPairs = impact ? impact.fullExchange / 2 : 0
  return (
    <details className="review-option" open={preferred}>
      <summary>
        <span className="review-option-title"><strong>{names(pairing.memberIds)}</strong><small>{optionLabel[kind]}{pairing.rotation && ` · Bloc ${pairing.rotation}`}</small></span>
        {selectable ? <ArrowRight size={17} aria-hidden="true" /> : <AlertTriangle size={17} className="review-blocked-icon" aria-hidden="true" />}
      </summary>
      <div className="review-option-body">
        {reason && <p>{reason}</p>}
        <div className="review-housing" aria-label="Places d’accueil et élèves à héberger">
          {Object.entries(pairing.result.hosting).map(([side, { available, required, sufficient }]) => (
            <span className={sufficient ? 'housing-yes' : 'housing-no'} key={side}>
              {sufficient ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              {side === 'bercher' ? 'Bercher' : 'Brugg'} · {available} {plural(available, 'place', 'places')} pour {required}
            </span>
          ))}
        </div>
        <Criteria result={pairing.result} />
        {impact && (
          <div className="review-impact">
            <strong>Après ce choix</strong>
            <span>{impact.placed} {plural(impact.placed, 'élève placé', 'élèves placés')} · {reciprocalPairs} {plural(reciprocalPairs, 'binôme réciproque', 'binômes réciproques')} · {impact.unplaced} en attente</span>
            {impact.addedStudentIds.length > 0 && <span>Placés en plus · {names(impact.addedStudentIds)}</span>}
            {impact.displacedStudentIds.length > 0 && <span>Restent à placer · {names(impact.displacedStudentIds)}</span>}
            {option.replaces.length > 0 && <span>{plural(option.replaces.length, 'Proposition modifiée', 'Propositions modifiées')} · {option.replaces.map((item) => names(item.memberIds)).join(' / ')}</span>}
          </div>
        )}
        {selectable && <button type="button" className="secondary-button" onClick={() => onChoose({ studentId, pairing })}><Check size={16} />{preferred ? 'Accepter cette proposition' : 'Choisir cette alternative'}</button>}
      </div>
    </details>
  )
}

export default function MatchingReviewModal({ students, scenario, onClose, onApply }) {
  const dialog = useRef(null)
  const [decisions, setDecisions] = useState([])
  const [tab, setTab] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const byId = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const name = (id) => fullName(byId.get(id))
  const names = (ids) => ids.map(name).join(' · ')

  const plan = useMemo(() => computeProvisionalPlan(students, scenario, {
    fixedPairings: decisions.flatMap((choice) => choice.pairing ? [choice.pairing] : []),
    deferredStudentIds: new Set(decisions.filter((choice) => !choice.pairing).map((choice) => choice.studentId)),
  }), [decisions, scenario, students])

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  const ready = [...plan.ordinaryPairings, ...plan.fixedPairings]
  const awaiting = [...plan.unplaced, ...plan.deferred]
  const invalidDecision = plan.invalidFixedPairings.length > 0
  const currentTab = tab || (plan.reviewItems.length ? 'review' : ready.length ? 'ready' : 'awaiting')
  const currentCase = plan.reviewItems.find(({ studentId }) => studentId === selectedId) || plan.reviewItems[0]
  const options = currentCase?.options || []
  const primary = options.find((option) => option.selectable) || options[0]
  const choose = (decision) => {
    setError('')
    setSelectedId(null)
    setTab(null)
    setDecisions((current) => [...current, decision])
  }
  const undo = () => {
    setError('')
    setTab(null)
    setDecisions((current) => current.slice(0, -1))
  }
  const finalize = () => {
    const errorMessage = onApply(ready)
    if (errorMessage) setError(errorMessage)
  }

  return (
    <dialog ref={dialog} className="matching-review-dialog" aria-labelledby="matching-review-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <header className="review-header">
        <div><h2 id="matching-review-title">Valider l’appairage</h2><p>{scenario.name}</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la validation"><X /></button>
      </header>
      <div className="review-tabs" aria-label="État de l’appairage">
        <button type="button" aria-pressed={currentTab === 'ready'} onClick={() => setTab('ready')}><Check aria-hidden="true" /> À valider <b>{ready.length}</b></button>
        <button type="button" aria-pressed={currentTab === 'review'} onClick={() => setTab('review')}><AlertTriangle aria-hidden="true" /> À examiner <b>{plan.reviewItems.length}</b></button>
        <button type="button" aria-pressed={currentTab === 'awaiting'} onClick={() => setTab('awaiting')}><CircleDashed aria-hidden="true" /> En attente <b>{awaiting.length}</b></button>
      </div>
      <div className="review-scroll">
        {currentTab === 'ready' && (ready.length ? (
          <ul className="review-simple-list">
            {ready.map((pairing) => (
              <li key={pairingKey(pairing)}><Check aria-hidden="true" /><span><strong>{names(pairing.memberIds)}</strong><small>Bloc {pairing.rotation}{plan.fixedPairings.includes(pairing) ? ' · Choix retenu' : ' · Proposition sans conflit'}</small></span></li>
            ))}
          </ul>
        ) : <p className="review-empty">Aucun groupe prêt à valider.</p>)}
        {currentTab === 'review' && (currentCase ? (
          <section className="review-case">
            <label>Élève à examiner
              <select value={currentCase.studentId} onChange={(event) => setSelectedId(event.target.value)}>
                {plan.reviewItems.map(({ studentId }) => <option key={studentId} value={studentId}>{name(studentId)}</option>)}
              </select>
            </label>
            <p className="review-reason"><AlertTriangle aria-hidden="true" /> {currentCase.reason}</p>
            <div className="review-options" key={currentCase.studentId}>
              {options.map((option) => (
                <ReviewOption key={`${option.kind}/${pairingKey(option.pairing)}`} option={option} preferred={option === primary} names={names} studentId={currentCase.studentId} onChoose={choose} />
              ))}
            </div>
            <button type="button" className="text-button review-defer" onClick={() => choose({ studentId: currentCase.studentId })}><CircleDashed size={16} /> Laisser cet élève en attente</button>
          </section>
        ) : <p className="review-empty">Aucun cas à examiner.</p>)}
        {currentTab === 'awaiting' && (awaiting.length ? (
          <ul className="review-simple-list review-unplaced">
            {awaiting.map(({ studentId, reason, options: blocked }) => (
              <li key={studentId}>
                <CircleDashed aria-hidden="true" />
                <span>
                  <strong>{name(studentId)}</strong><small>{reason}</small>
                  {blocked?.map((option) => <ReviewOption key={pairingKey(option.pairing)} option={option} names={names} />)}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="review-empty">Aucun élève en attente.</p>)}
        {decisions.length > 0 && (
          <details className="review-decisions">
            <summary>Décisions provisoires <b>{decisions.length}</b></summary>
            <ul>
              {decisions.map((decision) => (
                <li key={decision.pairing ? pairingKey(decision.pairing) : decision.studentId}>
                  <span>{decision.pairing ? names(decision.pairing.memberIds) : `${name(decision.studentId)} · En attente`}</span>
                  <button type="button" className="icon-button" aria-label={`Revenir sur le choix pour ${decision.pairing ? names(decision.pairing.memberIds) : name(decision.studentId)}`} onClick={() => { setError(''); setTab(null); setDecisions((current) => current.filter((choice) => choice !== decision)) }}><X size={16} /></button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <footer className="review-footer">
        {(error || invalidDecision) && <p className="review-error" role="alert">{error || 'Une décision provisoire ne peut plus être appliquée. Revenez sur ce choix.'}</p>}
        {plan.reviewItems.length > 0 && ready.length > 0 && <p>Les cas sans décision resteront en attente.</p>}
        <div className="review-actions">
          <button type="button" className="text-button" onClick={onClose}>Annuler</button>
          {decisions.length > 0 && <button type="button" className="secondary-button" onClick={undo}><Undo2 size={16} /> Revenir</button>}
          <button type="button" className="primary-button" onClick={finalize} disabled={!ready.length || invalidDecision}><Check size={18} /> Valider {ready.length} {plural(ready.length, 'groupe', 'groupes')}</button>
        </div>
      </footer>
    </dialog>
  )
}
