import { ContactRound, Download, FileJson, FileSpreadsheet, Upload, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ExportsView() {
  const { workspace, actions } = useWorkspace()
  const jsonRef = useRef(null)
  const [scenarioId, setScenarioId] = useState(workspace.activeScenarioId || workspace.scenarios[0]?.id || '')
  useEffect(() => {
    if (!workspace.scenarios.some((scenario) => scenario.id === scenarioId)) setScenarioId(workspace.activeScenarioId || workspace.scenarios[0]?.id || '')
  }, [workspace.scenarios, workspace.activeScenarioId, scenarioId])
  const scenario = workspace.scenarios.find((item) => item.id === scenarioId) || workspace.scenarios[0]
  return (
    <div className="view exports-view">
      <div className="view-heading"><div><h1>Exports</h1><p>Préparez les listes de travail et conservez une sauvegarde complète hors ligne.</p></div></div>
      <div className="export-list">
        <article><span className="export-icon"><FileSpreadsheet /></span><div><h2>Inscriptions complètes</h2><p>Toutes les fiches et contraintes, y compris les coordonnées. Document réservé aux responsables.</p></div><button className="secondary-button" onClick={async () => { const { exportStudentsXlsx } = await import('../lib/importExport'); exportStudentsXlsx(workspace) }}><Download size={17} /> Excel</button></article>
        <article className="scenario-export"><span className="export-icon"><ContactRound /></span><div><h2>Scénario d’appairage</h2><p>Groupes A et B côte à côte, puis le détail complet de chaque élève et de ses coordonnées.</p><label>Scénario à exporter<select value={scenario?.id || ''} onChange={(event) => setScenarioId(event.target.value)}>{workspace.scenarios.map((item) => <option key={item.id} value={item.id}>{item.name}{item.createdBy ? ` — créé par ${item.createdBy}` : ''}</option>)}</select></label></div><button className="secondary-button" onClick={async () => { const { exportScenarioXlsx } = await import('../lib/importExport'); exportScenarioXlsx(workspace, scenario) }} disabled={!scenario}><Download size={17} /> Excel</button></article>
        <article className="scenario-export"><span className="export-icon"><UsersRound /></span><div><h2>Mouvements des classes</h2><p>Pour le scénario choisi : élèves absents, élèves supplémentaires et solde pour chaque partie de la semaine.</p></div><button className="secondary-button" onClick={async () => { const { exportClassBalanceXlsx } = await import('../lib/importExport'); exportClassBalanceXlsx(workspace, scenario) }} disabled={!scenario}><Download size={17} /> Excel</button></article>
        <article><span className="export-icon"><FileJson /></span><div><h2>Sauvegarde technique</h2><p>Copie complète et réimportable de l’espace de travail. À conserver dans un emplacement privé.</p><input ref={jsonRef} hidden type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const { importJson } = await import('../lib/importExport'); const next = await importJson(file); if (window.confirm('Remplacer l’espace actuel par cette sauvegarde JSON ?')) actions.replaceWorkspace(next, `Sauvegarde restaurée: ${file.name}`) }} /></div><div className="button-row"><button className="secondary-button" onClick={() => jsonRef.current?.click()}><Upload size={17} /> Restaurer</button><button className="secondary-button" onClick={async () => { const { exportJson } = await import('../lib/importExport'); exportJson(workspace) }}><Download size={17} /> JSON</button></div></article>
      </div>
      <div className="warning-box privacy-export"><Download /><div><strong>Attention aux données personnelles</strong><p>Les fichiers téléchargés quittent l’espace sécurisé. Ne les placez pas dans le dépôt GitHub Pages et partagez-les uniquement par les canaux scolaires prévus.</p></div></div>
    </div>
  )
}
