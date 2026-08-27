import * as XLSX from '@e965/xlsx'
import { normalizeWorkspace } from '../data/demoData.js'
import { fullName, getCorrespondentStatus, normalizeSchool } from './compatibility.js'

const yes = (value) => value === true || ['OUI', 'YES', '1', 'VRAI'].includes(String(value || '').trim().toUpperCase())
const clean = (value) => String(value ?? '').trim()
const gender = (value) => {
  const normalized = clean(value).toLowerCase()
  if (['f', 'fille', 'female', 'féminin', 'feminin'].includes(normalized)) return 'female'
  if (['g', 'm', 'garçon', 'garcon', 'male', 'masculin'].includes(normalized)) return 'male'
  return 'unspecified'
}

const participation = (value) => {
  const normalized = clean(value).toLowerCase()
  if (normalized.includes('ne veut pas') || normalized.includes('ne voyage pas') || normalized.includes('accueille uniquement')) return 'host_only'
  if (normalized.includes('ne peut pas accueillir') || normalized.includes('accueil impossible')) return 'travel_no_host'
  return 'exchange_and_host'
}

const conditionType = (value) => {
  const normalized = clean(value).toLowerCase()
  if (normalized === 'regular_only' || normalized.includes('correspondant uniquement') || normalized.includes('correspondant actuel uniquement')) return 'regular_only'
  if (normalized === 'different_only' || normalized.includes('autre personne')) return 'different_only'
  if (normalized === 'named_only' || normalized.includes('personne précise') || normalized.includes('personne precise')) return 'named_only'
  return 'none'
}

const valueFrom = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== '') ?? ''

const studentFromModernRow = (row) => {
  const name = clean(valueFrom(row, 'Nom et prénom', 'Élève'))
  if (!name) return null
  const schoolValue = clean(valueFrom(row, 'Établissement', 'Filière'))
  const className = clean(row.Classe)
  const side = ['VP', 'VG', 'Bercher'].includes(schoolValue) || /^11V[PG]/i.test(className) ? 'bercher' : 'brugg'
  const normalizedParticipation = participation(row.Participation)
  const normalizedCondition = conditionType(valueFrom(row, 'Condition partenaire', 'Condition'))
  const groupCondition = clean(valueFrom(row, 'Condition de groupe', 'Groupe indispensable')).toUpperCase().match(/(?:GROUPE\s*)?([AB])\b/)?.[1] || ''
  const normalizedGender = gender(row.Genre)
  return {
    id: crypto.randomUUID(),
    side,
    name,
    firstName: '',
    lastName: '',
    school: normalizeSchool(schoolValue, className, side),
    className,
    gender: normalizedGender,
    participation: normalizedParticipation,
    conditionType: normalizedCondition,
    namedPartner: clean(valueFrom(row, 'Personne demandée', 'Personne précise')),
    regularCorrespondents: clean(row['Correspondant actuel']),
    canHost: normalizedParticipation !== 'travel_no_host',
    acceptsOtherGender: yes(row['Autre sexe accepté']),
    requiredRotation: groupCondition,
    active: clean(row['Échange maintenu']).toUpperCase() !== 'NON',
    otherInfo: clean(row['Autres infos utiles']),
    notes: '',
    animals: '',
    groupPreference: '',
    studentPhone: clean(row['Téléphone élève']),
    parentPhone: clean(row['Téléphone parents']),
    address: clean(row.Adresse),
    domicile: clean(row.Domicile),
    sharePhones: true,
    status: name && className && ['female', 'male'].includes(normalizedGender) && (normalizedCondition !== 'named_only' || clean(valueFrom(row, 'Personne demandée', 'Personne précise'))) ? 'complete' : 'review',
  }
}

const studentFromLegacy = (row, side, start) => {
  const name = clean(row[start + 1])
  if (!name) return null
  const parts = name.split(/\s+/)
  return {
    id: crypto.randomUUID(),
    side,
    name,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    school: normalizeSchool(side === 'bercher' ? '' : clean(row[start + 2]), clean(row[start + 2]), side),
    className: clean(row[start + 2]),
    gender: gender(row[start]),
    participation: 'exchange_and_host',
    conditionType: 'none',
    namedPartner: '',
    regularCorrespondents: clean(row[start + 3]),
    canHost: true,
    acceptsOtherGender: yes(row[start + 5]),
    animals: '',
    requiredRotation: '',
    legacyRotation: clean(row[start + 8]).toUpperCase(),
    active: true,
    groupPreference: '',
    notes: clean(row[start + 6]),
    studentPhone: '',
    parentPhone: '',
    address: '',
    domicile: '',
    sharePhones: true,
    status: 'review',
    assignmentHint: clean(row[start + 7]),
    legacyImport: true,
  }
}

const normalizedName = (student) => fullName(student).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function importLegacyWorkbook(file, currentWorkspace) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const modernRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const modernStudents = modernRows.map(studentFromModernRow).filter(Boolean)
  if (modernStudents.length) {
    const stamp = new Date().toISOString()
    const scenarioId = crypto.randomUUID()
    return normalizeWorkspace({
      ...currentWorkspace,
      students: modernStudents,
      scenarios: [{ id: scenarioId, name: 'Import Excel', status: 'draft', createdAt: stamp, updatedAt: stamp, pairings: [] }],
      activeScenarioId: scenarioId,
      activity: [{ id: crypto.randomUUID(), at: stamp, text: `${modernStudents.length} élèves importés depuis le nouveau format Excel.` }],
    })
  }
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
      rotation: source.legacyRotation || target.legacyRotation || '',
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
    exchange_and_host: 'Participe — accueil possible',
    travel_no_host: 'Participe — accueil impossible',
    host_only: 'Ne voyage pas — peut accueillir',
  }
  const rows = workspace.students.map((student) => ({
    'Nom et prénom': fullName(student),
    Établissement: schoolLabelForExport(student.school),
    Classe: student.className,
    Genre: student.gender,
    Participation: labels[student.participation],
    'Peut accueillir': student.canHost ? 'OUI' : 'NON',
    'Autre sexe accepté': student.acceptsOtherGender ? 'OUI' : 'NON',
    'Correspondant actuel': student.regularCorrespondents,
    'Correspondant ajouté': getCorrespondentStatus(student, workspace.students).state === 'found' ? 'OUI' : 'NON',
    'Condition partenaire': conditionLabelForExport(student.conditionType),
    'Personne demandée': student.namedPartner,
    'Condition de groupe': student.requiredRotation || '',
    'Échange maintenu': student.active === false ? 'NON' : 'OUI',
    'Autres infos utiles': student.otherInfo || [student.animals && `Animaux : ${student.animals}`, student.groupPreference && `Souhait de regroupement : ${student.groupPreference}`, student.notes].filter(Boolean).join('\n'),
    'Téléphone élève': student.studentPhone,
    'Téléphone parents': student.parentPhone,
    Adresse: student.address,
    Domicile: student.domicile,
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Inscriptions')
  XLSX.writeFile(workbook, `inscriptions-${workspace.meta.schoolYear}.xlsx`)
}

const schoolLabelForExport = (school) => school === 'Bezirksschule' ? 'Bez' : school === 'Sekundarschule' ? 'Sek' : school

const conditionLabelForExport = (condition) => ({
  none: 'Libre',
  regular_only: 'Correspondant actuel uniquement',
  different_only: 'Autre personne que le correspondant',
  named_only: 'Personne précise uniquement',
}[condition] || 'Libre')

export function exportScenarioXlsx(workspace, scenario) {
  const byId = new Map(workspace.students.map((student) => [student.id, student]))
  const rows = scenario.pairings.map((pairing, index) => {
    const members = pairing.memberIds.map((id) => byId.get(id)).filter(Boolean)
    return {
      Groupe: index + 1,
      Bercher: members.filter((student) => student.side === 'bercher').map(fullName).join(' + '),
      Brugg: members.filter((student) => student.side === 'brugg').map(fullName).join(' + '),
      Rotation: pairing.rotation,
      'Classe d’accueil à Bercher': pairing.bercherHostClass || members.find((student) => student.side === 'bercher')?.className || '',
      'Classe d’accueil à Brugg': pairing.bruggHostClass || members.find((student) => student.side === 'brugg')?.className || '',
      Validé: pairing.locked ? 'OUI' : 'NON',
      Notes: pairing.notes || '',
    }
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), scenario.name.slice(0, 31))
  XLSX.writeFile(workbook, `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.xlsx`)
}
