export const fullName = (student) => [student?.firstName, student?.lastName].filter(Boolean).join(' ').trim()

const normalized = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

export function findStudentByName(value, students, oppositeSide = '') {
  const wanted = normalized(value)
  if (!wanted) return null
  return students.find((student) => {
    if (oppositeSide && student.side !== oppositeSide) return false
    const candidate = normalized(fullName(student))
    return candidate && (candidate === wanted || wanted.includes(candidate) || candidate.includes(wanted))
  }) || null
}

export function getCorrespondentStatus(student, students) {
  const name = student?.regularCorrespondents?.trim() || ''
  if (!name) return { state: 'empty', name: '', student: null }
  const oppositeSide = student.side === 'bercher' ? 'brugg' : 'bercher'
  const match = findStudentByName(name, students, oppositeSide)
  return { state: match ? 'found' : 'missing', name, student: match }
}

export function getTrack(student) {
  if (!student) return ''
  if (student.side === 'bercher') {
    if (/VP/i.test(student.className || '')) return 'bezirk'
    if (/VG/i.test(student.className || '')) return 'sekundar'
  }
  if (student.school === 'Bezirksschule' || /^\s*B/i.test(student.className || '')) return 'bezirk'
  if (student.school === 'Sekundarschule' || /^\s*S/i.test(student.className || '')) return 'sekundar'
  return ''
}

export function getTrackLabel(student) {
  const track = getTrack(student)
  if (track === 'bezirk') return student.side === 'bercher' ? 'VP · préférence Bezirks' : 'Bezirks · préférence VP'
  if (track === 'sekundar') return student.side === 'bercher' ? 'VG · préférence Sekundar' : 'Sekundar · préférence VG'
  return 'Filière non reconnue'
}

export function evaluatePairing(memberIds, students) {
  const byId = new Map(students.map((student) => [student.id, student]))
  const members = memberIds.map((id) => byId.get(id)).filter(Boolean)
  const bercher = members.filter((student) => student.side === 'bercher')
  const brugg = members.filter((student) => student.side === 'brugg')
  const respected = []
  const warnings = []
  const conflicts = []

  if (!bercher.length || !brugg.length) conflicts.push('Le groupe doit contenir des élèves des deux écoles.')
  else respected.push('Les deux écoles sont représentées')

  if (bercher.length && brugg.length) {
    const trackPairs = bercher.flatMap((left) => brugg.map((right) => [getTrack(left), getTrack(right)]))
    const knownTrackPairs = trackPairs.filter(([left, right]) => left && right)
    if (knownTrackPairs.length && knownTrackPairs.every(([left, right]) => left === right)) {
      respected.push('Filières privilégiées respectées (VP ↔ Bezirks, VG ↔ Sekundar)')
    } else if (knownTrackPairs.some(([left, right]) => left !== right)) {
      warnings.push('Filières différentes : préférence seulement, jamais bloquante.')
    }
  }

  const activeRotations = [...new Set(members.map((student) => student.rotation).filter(Boolean))]
  if (activeRotations.length > 1) conflicts.push('Les rotations A/B ne correspondent pas.')
  else if (activeRotations.length === 1) respected.push(`Rotation ${activeRotations[0]} respectée`)
  else warnings.push('Rotation A/B non renseignée.')

  for (const student of members) {
    const opposite = student.side === 'bercher' ? brugg : bercher
    const oppositeNames = opposite.map(fullName).map(normalized)
    const regular = normalized(student.regularCorrespondents)
    const named = normalized(student.namedPartner)

    if (!student.acceptsOtherGender && student.gender !== 'unspecified') {
      const mismatch = opposite.some((item) => item.gender !== 'unspecified' && item.gender !== student.gender)
      if (mismatch) conflicts.push(`${fullName(student)} n’accepte pas un partenaire d’un autre sexe.`)
      else respected.push(`Condition de sexe respectée pour ${fullName(student)}`)
    }
    if (student.conditionType === 'regular_only') {
      if (!regular) warnings.push(`Correspondant habituel non renseigné pour ${fullName(student)}.`)
      else if (!oppositeNames.some((name) => regular.includes(name) || name.includes(regular))) conflicts.push(`Le correspondant habituel exigé par ${fullName(student)} n’est pas dans ce groupe.`)
      else respected.push(`Correspondant habituel respecté pour ${fullName(student)}`)
    }
    if (student.conditionType === 'named_only') {
      if (!named) conflicts.push(`La personne imposée par ${fullName(student)} n’est pas renseignée.`)
      else if (!oppositeNames.some((name) => named.includes(name) || name.includes(named))) conflicts.push(`La personne imposée par ${fullName(student)} n’est pas dans ce groupe.`)
      else respected.push(`Personne imposée respectée pour ${fullName(student)}`)
    }
    if (student.conditionType === 'different_only' && regular && oppositeNames.some((name) => regular.includes(name) || name.includes(regular))) {
      conflicts.push(`${fullName(student)} demande un autre partenaire que son correspondant habituel.`)
    }
    if (student.conditionType === 'different_only' && !regular) warnings.push(`Correspondant actuel non renseigné pour ${fullName(student)} : la demande d’un autre partenaire ne peut pas être vérifiée.`)
    if (student.conditionType === 'none') respected.push(`${fullName(student)} est libre quant au choix du partenaire`)
    if (student.notes) warnings.push(`Remarque confidentielle à vérifier pour ${fullName(student)}.`)
    if (student.status === 'review') warnings.push(`Fiche incomplète pour ${fullName(student)}.`)
  }

  const regularLinks = members.filter((student) => {
    const others = student.side === 'bercher' ? brugg : bercher
    return others.some((other) => normalized(student.regularCorrespondents).includes(normalized(fullName(other))))
  }).length
  if (regularLinks && !conflicts.length) respected.push('Lien de correspondance existant valorisé')

  const rawScore = 100 - conflicts.length * 28 - warnings.length * 6 + Math.min(regularLinks * 3, 6)
  const score = Math.max(0, Math.min(warnings.length ? 94 : 100, rawScore))
  return { score, respected: [...new Set(respected)], warnings: [...new Set(warnings)], conflicts: [...new Set(conflicts)] }
}

export function scenarioStats(scenario, students) {
  const studentIds = new Set(students.map((student) => student.id))
  const assigned = new Set(scenario.pairings.flatMap((pairing) => pairing.memberIds).filter((id) => studentIds.has(id)))
  const eligible = students
  const alertCount = scenario.pairings.filter((pairing) => evaluatePairing(pairing.memberIds, students).conflicts.length).length
  const groupA = scenario.pairings.filter((pairing) => pairing.rotation === 'A').length
  const groupB = scenario.pairings.filter((pairing) => pairing.rotation === 'B').length
  const undecided = scenario.pairings.filter((pairing) => !pairing.rotation).length
  return { assigned: assigned.size, unassigned: eligible.filter((student) => !assigned.has(student.id)).length, alertCount, groupA, groupB, undecided }
}
