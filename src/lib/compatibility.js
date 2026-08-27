export const fullName = (student) => student?.name?.trim() || [student?.firstName, student?.lastName].filter(Boolean).join(' ').trim()

export const schoolLabels = {
  VP: 'VP · Bercher',
  VG: 'VG · Bercher',
  Bezirksschule: 'Bez · Brugg',
  Sekundarschule: 'Sek · Brugg',
  Bercher: 'Bercher',
}

export const schoolLabel = (school) => schoolLabels[school] || school || 'Établissement non renseigné'

export function normalizeSchool(school, className = '', side = '') {
  const value = String(school || '').trim()
  if (side === 'bercher' || value === 'Bercher' || value === 'VP' || value === 'VG') {
    if (value === 'VP' || /VP/i.test(className)) return 'VP'
    if (value === 'VG' || /VG/i.test(className)) return 'VG'
    return 'Bercher'
  }
  if (value === 'Bez' || value === 'Bezirksschule' || /^B/i.test(className)) return 'Bezirksschule'
  if (value === 'Sek' || value === 'Sekundarschule' || /^S/i.test(className)) return 'Sekundarschule'
  return value
}

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
    if (student.school === 'VP' || /VP/i.test(student.className || '')) return 'bezirk'
    if (student.school === 'VG' || /VG/i.test(student.className || '')) return 'sekundar'
  }
  if (student.school === 'Bezirksschule' || /^\s*B/i.test(student.className || '')) return 'bezirk'
  if (student.school === 'Sekundarschule' || /^\s*S/i.test(student.className || '')) return 'sekundar'
  return ''
}

export function getTrackLabel(student) {
  const track = getTrack(student)
  if (track === 'bezirk') return student.side === 'bercher' ? 'VP · préférence Bez' : 'Bez · préférence VP'
  if (track === 'sekundar') return student.side === 'bercher' ? 'VG · préférence Sek' : 'Sek · préférence VG'
  return 'Filière non reconnue'
}

const hasNamed = (student, names) => {
  const wanted = normalized(student.namedPartner)
  return wanted && names.some((name) => wanted.includes(name) || name.includes(wanted))
}

const hasRegular = (student, names) => {
  const regular = normalized(student.regularCorrespondents)
  return regular && names.some((name) => regular.includes(name) || name.includes(regular))
}

const uniqueConditions = (items) => items.filter((item, index, array) => array.findIndex((candidate) => candidate.label === item.label) === index)

export function evaluatePairing(memberIds, students, rotation = '') {
  const byId = new Map(students.map((student) => [student.id, student]))
  const members = memberIds.map((id) => byId.get(id)).filter(Boolean)
  const bercher = members.filter((student) => student.side === 'bercher')
  const brugg = members.filter((student) => student.side === 'brugg')
  const indispensable = []
  const optional = []
  const addEssential = (state, label) => indispensable.push({ state, label })
  const addOptional = (state, label) => optional.push({ state, label })

  if (!bercher.length || !brugg.length) addEssential('fail', 'Le groupe doit contenir des élèves des deux écoles.')

  for (const student of members) {
    if (student.participation === 'host_only') addEssential('fail', `${fullName(student)} ne participe pas au déplacement.`)
    if (student.active === false) addEssential('fail', `${fullName(student)} a été retiré de l’échange.`)
    if (student.status === 'review') addOptional('review', `Fiche de ${fullName(student)} à vérifier.`)
  }

  if (members.length === 2 && members[0].gender === members[1].gender && ['female', 'male'].includes(members[0].gender)) {
    addEssential('pass', `Les deux élèves sont des ${members[0].gender === 'female' ? 'filles' : 'garçons'}.`)
  } else {
    const genderFailures = members.flatMap((student) => {
      if (student.acceptsOtherGender || !['female', 'male'].includes(student.gender)) return []
      const opposite = student.side === 'bercher' ? brugg : bercher
      const incompatible = opposite.find((item) => item.gender && item.gender !== 'unspecified' && item.gender !== student.gender)
      return incompatible ? [`${fullName(student)} ne peut pas être avec ${incompatible.gender === 'male' ? 'un garçon' : 'une fille'}.`] : []
    })
    if (genderFailures.length) genderFailures.forEach((label) => addEssential('fail', label))
    else addEssential('pass', members.every((student) => student.acceptsOtherGender) ? 'Les élèves acceptent un partenaire de l’autre sexe.' : 'La condition de genre est respectée.')
  }

  const requiredGroups = members.filter((student) => student.requiredRotation)
  if (!requiredGroups.length) addEssential('pass', 'Pas de condition de groupe spécifiée.')
  else {
    for (const student of requiredGroups) {
      if (!rotation) addEssential('review', `${fullName(student)} ne peut participer que dans le groupe ${student.requiredRotation}.`)
      else if (rotation !== student.requiredRotation) addEssential('fail', `${fullName(student)} ne peut pas être dans le groupe ${rotation}.`)
      else addOptional('pass', `${fullName(student)} est dans le groupe demandé (${rotation}).`)
    }
  }

  for (const student of members) {
    const opposite = student.side === 'bercher' ? brugg : bercher
    const oppositeNames = opposite.map(fullName).map(normalized)
    const requestedRegular = hasRegular(student, oppositeNames)
    const requestedNamed = hasNamed(student, oppositeNames)

    if (student.conditionType === 'regular_only') {
      if (!student.regularCorrespondents?.trim()) addEssential('review', `Le correspondant habituel exigé par ${fullName(student)} n’est pas renseigné.`)
      else if (!requestedRegular) addEssential('fail', `${fullName(student)} n’est pas avec son correspondant habituel exigé.`)
      else addEssential('pass', `${fullName(student)} est avec son correspondant habituel exigé.`)
    }
    if (student.conditionType === 'named_only') {
      if (!student.namedPartner?.trim()) addEssential('fail', `La personne choisie par ${fullName(student)} n’est pas renseignée.`)
      else if (!requestedNamed) addEssential('fail', `${fullName(student)} n’est pas avec le partenaire choisi en condition sine qua non.`)
      else addEssential('pass', `${fullName(student)} est avec le partenaire choisi en condition sine qua non.`)
    }
    if (student.conditionType === 'different_only') {
      if (!student.regularCorrespondents?.trim()) addEssential('review', `Le correspondant actuel de ${fullName(student)} n’est pas renseigné : cette condition doit être vérifiée.`)
      else if (requestedRegular) addEssential('fail', `${fullName(student)} ne veut pas être avec ${student.regularCorrespondents}.`)
      else addEssential('pass', `${fullName(student)} n’est pas avec son correspondant habituel.`)
    }
    if (student.conditionType === 'none' && student.regularCorrespondents?.trim()) {
      addOptional(requestedRegular ? 'pass' : 'review', requestedRegular
        ? `${fullName(student)} est avec le partenaire choisi (correspondant de base).`
        : `${fullName(student)} n’est pas avec le partenaire choisi (${student.regularCorrespondents}).`)
    }
    if (student.conditionType === 'none' && student.namedPartner?.trim()) {
      addOptional(requestedNamed ? 'pass' : 'review', requestedNamed
        ? `${fullName(student)} est avec le partenaire choisi.`
        : `${fullName(student)} n’est pas avec le partenaire choisi (${student.namedPartner}).`)
    }
  }

  if (members.length === 2 && members.every((student) => student.conditionType === 'none')) {
    const reciprocal = members.every((student) => hasRegular(student, [normalized(fullName(members.find((other) => other.id !== student.id)))]))
    if (reciprocal) addEssential('pass', 'Les deux élèves sont correspondants de base.')
    else if (!members.some((student) => student.regularCorrespondents?.trim() || student.namedPartner?.trim())) addEssential('pass', 'Les deux élèves ne sont pas correspondants et n’ont pas mis de condition.')
  }

  if (bercher.length && brugg.length) {
    const trackPairs = bercher.flatMap((left) => brugg.map((right) => [getTrack(left), getTrack(right)]))
    const knownTrackPairs = trackPairs.filter(([left, right]) => left && right)
    if (knownTrackPairs.length && knownTrackPairs.every(([left, right]) => left === right)) addOptional('pass', 'Les élèves sont dans les filières privilégiées (VG–Sek / VP–Bez).')
    else if (knownTrackPairs.some(([left, right]) => left !== right)) addOptional('review', 'Les élèves ne sont pas dans les mêmes filières (préférence seulement).')
  }

  const cleanEssential = uniqueConditions(indispensable)
  const cleanOptional = uniqueConditions(optional)
  const conflicts = cleanEssential.filter((item) => item.state === 'fail').map((item) => item.label)
  const warnings = [...cleanEssential.filter((item) => item.state === 'review'), ...cleanOptional.filter((item) => item.state === 'review')].map((item) => item.label)
  const respected = [...cleanEssential.filter((item) => item.state === 'pass'), ...cleanOptional.filter((item) => item.state === 'pass')].map((item) => item.label)
  const rawScore = 100 - conflicts.length * 30 - warnings.length * 5
  const score = Math.max(0, Math.min(warnings.length ? 94 : 100, rawScore))
  return { score, respected, warnings, conflicts, conditions: { indispensable: cleanEssential, optional: cleanOptional } }
}

export function scenarioStats(scenario, students) {
  const studentIds = new Set(students.map((student) => student.id))
  const studentsById = new Map(students.map((student) => [student.id, student]))
  const assigned = new Set(scenario.pairings.flatMap((pairing) => pairing.memberIds).filter((id) => studentIds.has(id) && studentsById.get(id)?.active !== false))
  const eligible = students.filter((student) => student.participation !== 'host_only' && student.active !== false)
  const alertCount = scenario.pairings.filter((pairing) => evaluatePairing(pairing.memberIds, students, pairing.rotation).conflicts.length).length
  const groupA = scenario.pairings.filter((pairing) => pairing.rotation === 'A').length
  const groupB = scenario.pairings.filter((pairing) => pairing.rotation === 'B').length
  const undecided = scenario.pairings.filter((pairing) => !pairing.rotation).length
  return { assigned: assigned.size, unassigned: eligible.filter((student) => !assigned.has(student.id)).length, alertCount, groupA, groupB, undecided }
}
