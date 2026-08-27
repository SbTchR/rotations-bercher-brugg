import * as XLSX from '@e965/xlsx'
import { normalizeWorkspace } from '../data/demoData.js'
import { fullName, getCorrespondentStatus, isStudentEnrollmentComplete, normalizeSchool } from './compatibility.js'
import { calculateClassMovementDetails } from './classBalance.js'

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
  const student = {
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
    status: 'review',
  }
  return { ...student, status: isStudentEnrollmentComplete(student) ? 'complete' : 'review' }
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

const genderLabelForExport = (genderValue) => ({ female: 'Fille', male: 'Garçon' }[genderValue] || 'Non renseigné')
const safeFilename = (value) => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario'
const participantDetails = (student) => [
  fullName(student),
  `${schoolLabelForExport(student.school)} · ${student.className || 'Classe non renseignée'}`,
  genderLabelForExport(student.gender),
  `Tél. élève : ${student.studentPhone || '—'}`,
  `Tél. parents : ${student.parentPhone || '—'}`,
  `Adresse : ${student.address || '—'}`,
  `Domicile : ${student.domicile || '—'}`,
].join('\n')
const namesForExport = (students) => students.length ? students.map((student) => `${fullName(student)} (${student.className || '—'})`).join('\n') : '—'

const titleStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 }, fill: { fgColor: { rgb: '117A8B' } }, alignment: { horizontal: 'center', vertical: 'center' } }
const sectionStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E91A0' } }, alignment: { horizontal: 'center', vertical: 'center' } }
const secondarySectionStyle = { font: { bold: true, color: { rgb: '843D29' } }, fill: { fgColor: { rgb: 'FFE9E2' } }, alignment: { horizontal: 'center', vertical: 'center' } }
const headerStyle = { font: { bold: true, color: { rgb: '334967' } }, fill: { fgColor: { rgb: 'EAF3F7' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
const cellStyle = { alignment: { vertical: 'top', wrapText: true } }

const applyStyle = (sheet, range, style) => {
  const decoded = XLSX.utils.decode_range(range)
  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
    for (let column = decoded.s.c; column <= decoded.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column })
      if (!sheet[address]) sheet[address] = { t: 's', v: '' }
      sheet[address].s = style
    }
  }
}

const pairingMembers = (pairing, byId, side) => pairing.memberIds.map((id) => byId.get(id)).filter((student) => student?.side === side)

export function buildScenarioWorkbook(workspace, scenario) {
  const byId = new Map(workspace.students.map((student) => [student.id, student]))
  const workbook = XLSX.utils.book_new()
  const groupsA = scenario.pairings.filter((pairing) => pairing.rotation === 'A')
  const groupsB = scenario.pairings.filter((pairing) => pairing.rotation === 'B')
  const groupRows = [[`Scénario : ${scenario.name}`, '', '', '', '', '', '', '', ''], ['Groupes A', '', '', '', '', 'Groupes B', '', '', ''], ['Groupe', 'Élève(s) de Bercher', 'Élève(s) de Brugg', 'Validation / informations', '', 'Groupe', 'Élève(s) de Bercher', 'Élève(s) de Brugg', 'Validation / informations']]
  const groupCount = Math.max(groupsA.length, groupsB.length, 1)
  for (let index = 0; index < groupCount; index += 1) {
    const addGroup = (pairing, block, number) => {
      if (!pairing) return ['', '', '', '']
      const bercher = pairingMembers(pairing, byId, 'bercher')
      const brugg = pairingMembers(pairing, byId, 'brugg')
      return [
        `${block}${number}`,
        bercher.map(participantDetails).join('\n\n'),
        brugg.map(participantDetails).join('\n\n'),
        [
          pairing.locked ? 'Validé' : 'À contrôler',
          `Accueil à Bercher : ${pairing.bercherHostClass || bercher[0]?.className || '—'}`,
          `Accueil à Brugg : ${pairing.bruggHostClass || brugg[0]?.className || '—'}`,
          pairing.notes ? `Note : ${pairing.notes}` : '',
        ].filter(Boolean).join('\n'),
      ]
    }
    groupRows.push([...addGroup(groupsA[index], 'A', index + 1), '', ...addGroup(groupsB[index], 'B', index + 1)])
  }
  const groupsSheet = XLSX.utils.aoa_to_sheet(groupRows)
  groupsSheet['!merges'] = [XLSX.utils.decode_range('A1:I1'), XLSX.utils.decode_range('A2:D2'), XLSX.utils.decode_range('F2:I2')]
  groupsSheet['!cols'] = [{ wch: 10 }, { wch: 38 }, { wch: 38 }, { wch: 30 }, { wch: 3 }, { wch: 10 }, { wch: 38 }, { wch: 38 }, { wch: 30 }]
  groupsSheet['!rows'] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 31 }, ...Array.from({ length: groupCount }, () => ({ hpt: 130 }))]
  applyStyle(groupsSheet, 'A1:I1', titleStyle)
  applyStyle(groupsSheet, 'A2:D2', sectionStyle)
  applyStyle(groupsSheet, 'F2:I2', secondarySectionStyle)
  applyStyle(groupsSheet, 'A3:D3', headerStyle)
  applyStyle(groupsSheet, 'F3:I3', headerStyle)
  applyStyle(groupsSheet, `A4:I${groupCount + 3}`, cellStyle)
  XLSX.utils.book_append_sheet(workbook, groupsSheet, 'Groupes A-B')

  const orderedPairings = [...scenario.pairings].sort((left, right) => (left.rotation || 'Z').localeCompare(right.rotation || 'Z'))
  const detailedRows = [[`Détail des élèves — ${scenario.name}`, '', '', '', '', '', '', '', '', '', '', '', '', ''], ['Bloc', 'Groupe', 'École', 'Nom et prénom', 'Classe', 'Genre', 'Téléphone élève', 'Téléphone parents', 'Adresse', 'Domicile', 'Autres membres du groupe', 'Classe d’accueil', 'Validé', 'Note']]
  const blockCounters = { A: 0, B: 0, '': 0 }
  for (const pairing of orderedPairings) {
    const block = pairing.rotation || ''
    blockCounters[block] += 1
    const members = pairing.memberIds.map((id) => byId.get(id)).filter(Boolean)
    for (const member of members) {
      const others = members.filter((student) => student.id !== member.id)
      const hostClass = member.side === 'bercher' ? pairing.bercherHostClass || members.find((student) => student.side === 'bercher')?.className || '' : pairing.bruggHostClass || members.find((student) => student.side === 'brugg')?.className || ''
      detailedRows.push([block || 'À décider', `${block || '—'}${blockCounters[block]}`, member.side === 'bercher' ? 'Bercher' : 'Brugg', fullName(member), member.className || '', genderLabelForExport(member.gender), member.studentPhone || '', member.parentPhone || '', member.address || '', member.domicile || '', namesForExport(others), hostClass, pairing.locked ? 'OUI' : 'NON', pairing.notes || ''])
    }
  }
  const detailsSheet = XLSX.utils.aoa_to_sheet(detailedRows)
  detailsSheet['!merges'] = [XLSX.utils.decode_range('A1:N1')]
  detailsSheet['!cols'] = [{ wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 19 }, { wch: 26 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 11 }, { wch: 30 }]
  detailsSheet['!rows'] = [{ hpt: 26 }, { hpt: 32 }, ...Array.from({ length: Math.max(detailedRows.length - 2, 1) }, () => ({ hpt: 38 }))]
  detailsSheet['!autofilter'] = { ref: `A2:N${Math.max(detailedRows.length, 2)}` }
  applyStyle(detailsSheet, 'A1:N1', titleStyle)
  applyStyle(detailsSheet, 'A2:N2', headerStyle)
  applyStyle(detailsSheet, `A3:N${Math.max(detailedRows.length, 3)}`, cellStyle)
  XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Détail des élèves')
  return workbook
}

export function exportScenarioXlsx(workspace, scenario) {
  const workbook = buildScenarioWorkbook(workspace, scenario)
  XLSX.writeFile(workbook, `${safeFilename(scenario.name)}.xlsx`)
}

export function buildClassBalanceWorkbook(workspace, scenario) {
  const { classes, undecidedPairings } = calculateClassMovementDetails(scenario, workspace.students)
  const rows = [[`Mouvements des classes — ${scenario.name}`, '', '', '', '', '', '', ''], ['', '', '1re partie de la semaine', '', '', '2e partie de la semaine', '', ''], ['Établissement', 'Classe', 'Élèves absents', 'Élèves supplémentaires', 'Solde', 'Élèves absents', 'Élèves supplémentaires', 'Solde']]
  for (const row of classes) {
    rows.push([
      schoolLabelForExport(row.school),
      row.className,
      namesForExport(row.first.outgoing),
      namesForExport(row.first.incoming),
      row.first.net > 0 ? `+${row.first.net} élève${row.first.net > 1 ? 's' : ''}` : row.first.net < 0 ? `${row.first.net} élève${row.first.net < -1 ? 's' : ''}` : '0 élève',
      namesForExport(row.second.outgoing),
      namesForExport(row.second.incoming),
      row.second.net > 0 ? `+${row.second.net} élève${row.second.net > 1 ? 's' : ''}` : row.second.net < 0 ? `${row.second.net} élève${row.second.net < -1 ? 's' : ''}` : '0 élève',
    ])
  }
  if (undecidedPairings) rows.push(['', '', `Attention : ${undecidedPairings} groupe${undecidedPairings > 1 ? 's ne sont' : ' n’est'} pas compté${undecidedPairings > 1 ? 's' : ''} car le bloc A/B n’est pas défini.`, '', '', '', '', ''])
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [XLSX.utils.decode_range('A1:H1'), XLSX.utils.decode_range('C2:E2'), XLSX.utils.decode_range('F2:H2')]
  sheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 31 }, { wch: 31 }, { wch: 14 }, { wch: 31 }, { wch: 31 }, { wch: 14 }]
  sheet['!rows'] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 32 }, ...Array.from({ length: Math.max(rows.length - 3, 1) }, () => ({ hpt: 44 }))]
  sheet['!autofilter'] = { ref: `A3:H${Math.max(rows.length, 3)}` }
  applyStyle(sheet, 'A1:H1', titleStyle)
  applyStyle(sheet, 'C2:E2', sectionStyle)
  applyStyle(sheet, 'F2:H2', secondarySectionStyle)
  applyStyle(sheet, 'A3:H3', headerStyle)
  applyStyle(sheet, `A4:H${Math.max(rows.length, 4)}`, cellStyle)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Mouvements des classes')
  return workbook
}

export function exportClassBalanceXlsx(workspace, scenario) {
  XLSX.writeFile(buildClassBalanceWorkbook(workspace, scenario), `${safeFilename(scenario.name)}-mouvements-classes.xlsx`)
}
