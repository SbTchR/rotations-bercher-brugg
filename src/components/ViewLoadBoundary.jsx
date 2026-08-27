import { Component } from 'react'

export default class ViewLoadBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="view-load-error" role="alert">
        <span aria-hidden="true">!</span>
        <h1>Impossible d’ouvrir cette page</h1>
        <p>L’application vient peut-être d’être mise à jour. Rechargez-la pour ouvrir la dernière version.</p>
        <div className="button-row">
          <button className="primary-button" onClick={() => window.location.reload()}>Recharger l’application</button>
          <button className="secondary-button" onClick={() => { window.location.hash = '/dashboard'; window.location.reload() }}>Retour à l’accueil</button>
        </div>
      </section>
    )
  }
}
