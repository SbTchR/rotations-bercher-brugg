import * as XLSX from '@e965/xlsx'
import { describe, expect, it } from 'vitest'
import { createBlankWorkspace } from '../data/demoData.js'
import { buildClassBalanceWorkbook, buildScenarioWorkbook, importLegacyWorkbook } from './importExport.js'

describe('modern Excel import', () => {
  it('imports detailed conditions from one row per pupil', async () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        'Nom et prénom': 'Léa Martin',
        Établissement: 'VP',
        Classe: '11VP1',
        Genre: 'Fille',
        Participation: 'Aimerait participer mais ne peut pas accueillir',
        'Autre sexe accepté': 'NON',
        'Correspondant actuel': 'Nora Keller',
        'Condition partenaire': 'Personne précise uniquement',
        'Personne demandée': 'Nora Keller',
        'Condition de groupe': 'B',
        'Autres infos utiles': 'Allergie aux chats',
        'Échange maintenu': 'OUI',
      },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inscriptions')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = { arrayBuffer: async () => bytes }
    const result = await importLegacyWorkbook(file, createBlankWorkspace())
    expect(result.students).toHaveLength(1)
    expect(result.students[0]).toMatchObject({
      name: 'Léa Martin',
      school: 'VP',
      gender: 'female',
      participation: 'travel_no_host',
      canHost: false,
      acceptsOtherGender: false,
      conditionType: 'named_only',
      namedPartner: 'Nora Keller',
      requiredRotation: 'B',
      otherInfo: 'Allergie aux chats',
      active: true,
      status: 'complete',
    })
  })

  it('construit un export de scénario avec les blocs A/B et le détail des élèves', () => {
    const workspace = createBlankWorkspace()
    workspace.students = [
      { id: 'b1', side: 'bercher', name: 'Léa Martin', school: 'VP', className: '11VP1', gender: 'female', studentPhone: '079 111 11 11', parentPhone: '079 222 22 22', address: 'Rue du Lac 1', domicile: 'Bercher' },
      { id: 'r1', side: 'brugg', name: 'Nora Keller', school: 'Bezirksschule', className: 'B1', gender: 'female', studentPhone: '076 333 33 33', parentPhone: '076 444 44 44', address: 'Hauptstrasse 2', domicile: 'Brugg' },
    ]
    const scenario = { id: 's1', name: 'Essai A-B', pairings: [{ id: 'p1', memberIds: ['b1', 'r1'], rotation: 'A', locked: true, notes: '' }] }
    const workbook = buildScenarioWorkbook(workspace, scenario)
    expect(workbook.SheetNames).toEqual(['Groupes A-B', 'Détail des élèves'])
    expect(workbook.Sheets['Groupes A-B'].A2.v).toBe('Groupes A')
    expect(workbook.Sheets['Groupes A-B'].B4.v).toBe('Léa Martin · 11VP1\n\nRue du Lac 1\nBercher\nTél. élève : 079 111 11 11\nTél. parents : 079 222 22 22')
    expect(workbook.Sheets['Groupes A-B'].D3.v).toBe('')
    expect(Object.values(workbook.Sheets['Groupes A-B']).some((cell) => cell?.v === 'Validation / informations')).toBe(false)
    expect(workbook.Sheets['Détail des élèves'].G3.v).toBe('079 111 11 11')
  })

  it('construit un export des mouvements avec les noms des élèves', () => {
    const workspace = createBlankWorkspace()
    workspace.students = [
      { id: 'b1', side: 'bercher', name: 'Léa Martin', school: 'VP', className: '11VP1', gender: 'female' },
      { id: 'r1', side: 'brugg', name: 'Nora Keller', school: 'Bezirksschule', className: 'B1', gender: 'female' },
    ]
    const workbook = buildClassBalanceWorkbook(workspace, { name: 'Essai A-B', pairings: [{ id: 'p1', memberIds: ['b1', 'r1'], rotation: 'A' }] })
    const sheet = workbook.Sheets['Mouvements des classes']
    expect(sheet.C4.v).toContain('Léa Martin')
    expect(sheet.G4.v).toContain('Nora Keller')
    expect(sheet.C4.v).not.toContain('11VP1')
    expect(sheet.G4.v).not.toContain('B1')
    expect(sheet.E4.v).toBe('-1 élève')
  })
})
