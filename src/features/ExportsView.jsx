import { ContactRound, Download, FileJson, FileSpreadsheet, Printer, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ExportsView() {
  const { workspace, actions } = useWorkspace()
  const jsonRef = useRef(null)
  const scenario = workspace.scenarios.find((item) => item.id === workspace.activeScenarioId) || workspace.scenarios[0]
  return (
    <div className="view exports-view">
      <div className="view-heading"><div><h1>Exports</h1><p>Préparez les listes de travail et conservez une sauvegarde complète hors ligne.</p></div></div>
      <div className="export-list">
        <article><span className="export-icon"><FileSpreadsheet /></span><div><h2>Inscriptions complètes</h2><p>Toutes les fiches et contraintes, y compris les coordonnées. Document réservé aux responsables.</p></div><button className="secondary-button" onClick={async () => { const { exportStudentsXlsx } = await import('../lib/importExport'); exportStudentsXlsx(workspace) }}><Download size={17} /> Excel</button></article>
        <article><span className="export-icon"><ContactRound /></span><div><h2>{scenario.name}</h2><p>Liste claire des binômes et groupes, rotations A/B, validation et notes de travail.</p></div><button className="secondary-button" onClick={async () => { const { exportScenarioXlsx } = await import('../lib/importExport'); exportScenarioXlsx(workspace, scenario) }}><Download size={17} /> Excel</button></article>
        <article><span className="export-icon"><Printer /></span><div><h2>Vue imprimable</h2><p>Imprimez la page d’appairage active ou enregistrez-la en PDF depuis le navigateur.</p></div><button className="secondary-button" onClick={() => window.print()}><Printer size={17} /> Imprimer</button></article>
        <article><span className="export-icon"><FileJson /></span><div><h2>Sauvegarde technique</h2><p>Copie complète et réimportable de l’espace de travail. À conserver dans un emplacement privé.</p><input ref={jsonRef} hidden type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const { importJson } = await import('../lib/importExport'); const next = await importJson(file); if (window.confirm('Remplacer l’espace actuel par cette sauvegarde JSON ?')) actions.replaceWorkspace(next, `Sauvegarde restaurée: ${file.name}`) }} /></div><div className="button-row"><button className="secondary-button" onClick={() => jsonRef.current?.click()}><Upload size={17} /> Restaurer</button><button className="secondary-button" onClick={async () => { const { exportJson } = await import('../lib/importExport'); exportJson(workspace) }}><Download size={17} /> JSON</button></div></article>
      </div>
      <div className="warning-box privacy-export"><Download /><div><strong>Attention aux données personnelles</strong><p>Les fichiers téléchargés quittent l’espace sécurisé. Ne les placez pas dans le dépôt GitHub Pages et partagez-les uniquement par les canaux scolaires prévus.</p></div></div>
    </div>
  )
}
