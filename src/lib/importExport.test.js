import * as XLSX from '@e965/xlsx'
import { describe, expect, it } from 'vitest'
import { createBlankWorkspace } from '../data/demoData.js'
import { importLegacyWorkbook } from './importExport.js'

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
})
