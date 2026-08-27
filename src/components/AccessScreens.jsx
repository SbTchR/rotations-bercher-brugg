import { KeyRound, LockKeyhole, LogIn, ShieldAlert, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Brand } from './AppShell'
import { useWorkspace } from '../context/WorkspaceContext'

export function LoadingScreen() {
  return <div className="access-screen"><Brand /><div className="loader" /><p>Ouverture de l’espace de travail…</p></div>
}

export function AuthScreen() {
  const { signInWithCredentials } = useWorkspace()
  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setState('loading')
    setMessage('')
    try {
      await signInWithCredentials(accountId, password)
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
        <p>Connectez-vous avec l’identifiant et le mot de passe qui vous ont été transmis.</p>
        <form onSubmit={submit}>
          <label>Identifiant<span className="auth-input"><UserRound size={17} /><input required autoComplete="username" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="responsable1" /></span></label>
          <label>Mot de passe<span className="auth-input"><KeyRound size={17} /><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></span></label>
          <button className="primary-button" disabled={state === 'loading'}><LogIn size={18} /> {state === 'loading' ? 'Connexion…' : 'Se connecter'}</button>
          {message && <p className="form-error" role="alert">{message}</p>}
        </form>
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
        <p>L’accès aux informations est fermé au public. Le stockage sécurisé et les comptes autorisés doivent encore être reliés à cette page.</p>
        <div className="privacy-note"><LockKeyhole size={16} /> Aucune donnée d’élève n’est affichée ni enregistrée sur GitHub Pages.</div>
      </section>
    </div>
  )
}

export function AccessProblem({ unauthorized = false }) {
  const { syncMessage, reload, signOut } = useWorkspace()
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Brand />
        <ShieldAlert className="auth-icon warning" size={36} />
        <h1>{unauthorized ? 'Adresse non autorisée' : 'Impossible d’ouvrir l’espace'}</h1>
        <p>{unauthorized ? 'Ce compte est connecté, mais il n’est pas autorisé à ouvrir l’espace partagé.' : syncMessage}</p>
        <div className="button-row">
          <button className="secondary-button" onClick={reload}>Réessayer</button>
          {unauthorized && <button className="text-button" onClick={signOut}>Changer de compte</button>}
        </div>
      </section>
    </div>
  )
}
