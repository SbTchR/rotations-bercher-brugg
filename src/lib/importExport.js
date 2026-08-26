import * as XLSX from '@e965/xlsx'
import { normalizeWorkspace } from '../data/demoData.js'

const yes = (value) => String(value || '').trim().toUpperCase() === 'OUI'
const clean = (value) => String(value ?? '').trim()
const gender = (value) => {
  const normalized = clean(value).toLowerCase()
  if (normalized === 'f') return 'female'
  if (normalized === 'g' || normalized === 'm') return 'male'
  return 'unspecified'
}

const studentFromLegacy = (row, side, start) => {
  const name = clean(row[start + 1])
  if (!name) return null
  const parts = name.split(/\s+/)
  const firstName = parts.shift() || ''
  const multiple = yes(row[start + 4])
  return {
    id: crypto.randomUUID(),
    side,
    firstName,
    lastName: parts.join(' '),
    school: side === 'bercher' ? 'Bercher' : clean(row[start + 2]).toUpperCase().startsWith('S') ? 'Sekundarschule' : 'Bezirksschule',
    className: clean(row[start + 2]),
    gender: gender(row[start]),
    participation: 'exchange_and_host',
    conditionType: 'none',
    namedPartner: '',
    regularCorrespondents: clean(row[start + 3]),
    canHost: true,
    maxGuests: multiple ? 2 : 1,
    acceptsOtherGender: yes(row[start + 5]),
    animals: '',
    rotation: clean(row[start + 8]).toUpperCase(),
    groupPreference: '',
    notes: clean(row[start + 6]),
    studentPhone: '',
    parentPhone: '',
    address: '',
    sharePhones: true,
    status: 'review',
    assignmentHint: clean(row[start + 7]),
    legacyImport: true,
  }
}

const normalizedName = (student) => `${student.firstName} ${student.lastName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function importLegacyWorkbook(file, currentWorkspace) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const imported = []
  for (const row of rows.slice(3)) {
    const bercher = studentFromLegacy(row, 'bercher', 2)
    const brugg = studentFromLegacy(row, 'brugg', 14)
    if (bercher) imported.push(bercher)
    if (brugg) imported.push(brugg)
  }
  if (!imported.length) throw new Error('Aucun élève reconnu. Le fichier attendu contient les deux tableaux à partir de la ligne 4.')

  const byName = new Map(imported.map((student) => [normalizedName(student), student]))
  const paired = new Set()
  const pairings = []
  for (const source of imported) {
    if (!source.assignmentHint || paired.has(source.id)) continue
    const key = source.assignmentHint.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const target = byName.get(key)
    if (!target || target.side === source.side || paired.has(target.id)) continue
    pairings.push({
      id: crypto.randomUUID(),
      memberIds: [source.id, target.id],
      rotation: source.rotation || target.rotation || '',
      locked: false,
      notes: 'Importé du classeur — à valider.',
    })
    paired.add(source.id)
    paired.add(target.id)
  }

  const stamp = new Date().toISOString()
  return normalizeWorkspace({
    ...currentWorkspace,
    students: imported,
    scenarios: [{ id: crypto.randomUUID(), name: 'Import Excel', status: 'draft', createdAt: stamp, updatedAt: stamp, pairings }],
    activeScenarioId: null,
    activity: [{ id: crypto.randomUUID(), at: stamp, text: `${imported.length} élèves importés; ${pairings.length} appairages exacts récupérés.` }],
  })
}

const download = (blob, filename) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

export function exportJson(workspace) {
  download(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }), `rotations-${workspace.meta.schoolYear}.json`)
}

export async function importJson(file) {
  return normalizeWorkspace(JSON.parse(await file.text()))
}

export function exportStudentsXlsx(workspace) {
  const labels = {
    exchange_and_host: 'Participe et accueille',
    travel_no_host: 'Participe — accueil impossible',
    host_only: 'Accueille uniquement',
    declined: 'Ne participe pas',
  }
  const rows = workspace.students.map((student) => ({
    Élève: `${student.firstName} ${student.lastName}`.trim(),
    Établissement: student.school,
    Classe: student.className,
    Genre: student.gender,
    Participation: labels[student.participation],
    'Peut accueillir': student.canHost ? 'OUI' : 'NON',
    'Nombre de places': student.maxGuests || 0,
    'Autre sexe accepté': student.acceptsOtherGender ? 'OUI' : 'NON',
    'Correspondants habituels': student.regularCorrespondents,
    'Condition': student.conditionType,
    'Personne précise': student.namedPartner,
    Rotation: student.rotation,
    Animaux: student.animals,
    Remarques: student.notes,
    'Téléphone élève': student.studentPhone,
    'Téléphone parents': student.parentPhone,
    Adresse: student.address,
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Inscriptions')
  XLSX.writeFile(workbook, `inscriptions-${workspace.meta.schoolYear}.xlsx`)
}

export function exportScenarioXlsx(workspace, scenario) {
  const byId = new Map(workspace.students.map((student) => [student.id, student]))
  const rows = scenario.pairings.map((pairing, index) => {
    const members = pairing.memberIds.map((id) => byId.get(id)).filter(Boolean)
    return {
      Groupe: index + 1,
      Bercher: members.filter((student) => student.side === 'bercher').map((student) => `${student.firstName} ${student.lastName}`.trim()).join(' + '),
      Brugg: members.filter((student) => student.side === 'brugg').map((student) => `${student.firstName} ${student.lastName}`.trim()).join(' + '),
      Rotation: pairing.rotation,
      Validé: pairing.locked ? 'OUI' : 'NON',
      Notes: pairing.notes || '',
    }
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), scenario.name.slice(0, 31))
  XLSX.writeFile(workbook, `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.xlsx`)
}
