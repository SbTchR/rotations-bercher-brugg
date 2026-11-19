import { CircleHelp, MessageCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MATCHING_COMMENT_LIMIT } from '../lib/matchingComments'
import './matchingDiscussion.css'

const messageDate = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short' })
const messageCount = (count) => `${count} ${count === 1 ? 'message' : 'messages'}`

export function DiscussionBadge({ count }) {
  if (!count) return null
  const label = messageCount(count)
  return (
    <span className="discussion-badge" role="img" aria-label={label} title={label}>
      <MessageCircle size={12} aria-hidden="true" /><span aria-hidden="true">{count}</span>
    </span>
  )
}

export function DiscussionButton({ count, onClick }) {
  return (
    <button type="button" className="inspector-discussion-button" onClick={onClick}>
      <MessageCircle size={17} aria-hidden="true" />
      <span>Commentaires et questions</span>
      {count > 0 && <span className="discussion-badge">{count}</span>}
    </button>
  )
}

export default function MatchingDiscussion({ subject, comments, onAdd, onClose }) {
  const dialogRef = useRef(null)
  const [kind, setKind] = useState('comment')
  const [text, setText] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const submit = (event) => {
    event.preventDefault()
    if (onAdd({ kind, text })) setText('')
  }

  return (
    <dialog ref={dialogRef} className="matching-discussion-dialog" aria-labelledby="discussion-heading" aria-describedby="discussion-subject" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <header>
        <div><h2 id="discussion-heading">Commentaires et questions</h2><p id="discussion-subject">{subject}</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer les commentaires"><X /></button>
      </header>
      <div className="discussion-scroll" aria-live="polite">
        {comments.length ? (
          <ul className="discussion-list">
            {[...comments].reverse().map((entry) => {
              const question = entry.kind === 'question'
              const Icon = question ? CircleHelp : MessageCircle
              return (
                <li key={entry.id}>
                  <header>
                    <span className={`discussion-kind ${question ? 'question' : ''}`}><Icon size={14} aria-hidden="true" />{question ? 'Question' : 'Commentaire'}</span>
                    <strong>{entry.author || 'Compte local'}</strong>
                    {Number.isFinite(Date.parse(entry.at)) && <time dateTime={entry.at}>{messageDate.format(new Date(entry.at))}</time>}
                  </header>
                  <p>{entry.text}</p>
                </li>
              )
            })}
          </ul>
        ) : <p className="discussion-empty">Aucun message pour le moment.</p>}
      </div>
      <form className="discussion-form" onSubmit={submit}>
        <label>Type de message
          <select aria-label="Type de message" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="comment">Commentaire</option>
            <option value="question">Question</option>
          </select>
        </label>
        <label>Votre message
          <textarea rows="3" value={text} onChange={(event) => setText(event.target.value)} maxLength={MATCHING_COMMENT_LIMIT} required />
        </label>
        <button type="submit" className="primary-button" disabled={!text.trim()}>Ajouter</button>
      </form>
    </dialog>
  )
}
