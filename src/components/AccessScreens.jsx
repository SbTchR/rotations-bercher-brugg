import { CheckCircle2, LockKeyhole, Mail, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Brand } from './AppShell'
import { useWorkspace } from '../context/WorkspaceContext'

export function LoadingScreen() {
  return <div className="access-screen"><Brand /><div className="loader" /><p>Ouverture de l’espace de travail…</p></div>
}

export function AuthScreen() {
  const { requestMagicLink } = useWorkspace()
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setState('loading')
    setMessage('')
    try {
      await requestMagicLink(email)
      setState('sent')
    } catch (error) {
      setState('error')
      setMessage(error.message)
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Brand />
        <LockKeyhole className="auth-icon" size={36} />
        <h1>Espace réservé aux responsables</h1>
        <p>Entrez votre adresse professionnelle autorisée. Vous recevrez un lien de connexion sans mot de passe.</p>
        {state === 'sent' ? (
          <div className="success-box"><CheckCircle2 /> <span>Le lien a été envoyé. Vous pouvez revenir ici après avoir ouvert l’e-mail.</span></div>
        ) : (
          <form onSubmit={submit}>
            <label>Adresse e-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="prenom.nom@ecole.ch" /></label>
            <button className="primary-button" disabled={state === 'loading'}><Mail size={18} /> Recevoir le lien</button>
            {message && <p className="form-error">{message}</p>}
          </form>
        )}
        <small>Les données ne sont jamais stockées dans GitHub Pages.</small>
      </section>
    </div>
  )
}

export function ConfigurationRequired() {
  return (
    <div className="auth-page">
      <section className="auth-panel private-gate">
        <Brand />
        <LockKeyhole className="auth-icon" size={36} />
        <h1>Espace privé non activé</h1>
        <p>L’accès aux informations est fermé au public. Le stockage sécurisé et les trois adresses autorisées doivent encore être reliés à cette page.</p>
        <div className="privacy-note"><LockKeyhole size={16} /> Aucune donnée d’élève n’est affichée ni enregistrée sur GitHub Pages.</div>
      </section>
    </div>
  )
}

export function AccessProblem({ unauthorized = false }) {
  const { user, syncMessage, reload, signOut } = useWorkspace()
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Brand />
        <ShieldAlert className="auth-icon warning" size={36} />
        <h1>{unauthorized ? 'Adresse non autorisée' : 'Impossible d’ouvrir l’espace'}</h1>
        <p>{unauthorized ? `${user?.email || 'Cette adresse'} est connectée, mais ne figure pas encore parmi les trois responsables.` : syncMessage}</p>
        <div className="button-row">
          <button className="secondary-button" onClick={reload}>Réessayer</button>
          {unauthorized && <button className="text-button" onClick={signOut}>Changer de compte</button>}
        </div>
      </section>
    </div>
  )
}
