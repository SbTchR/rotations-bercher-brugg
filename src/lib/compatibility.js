export const fullName = (student) => [student?.firstName, student?.lastName].filter(Boolean).join(' ').trim()

const normalized = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const travels = (student) => ['exchange_and_host', 'travel_no_host'].includes(student.participation)
const hosts = (student) => student.canHost && ['exchange_and_host', 'host_only'].includes(student.participation)

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

  const checkHosting = (hostsSide, visitors, label) => {
    const capacity = hostsSide.filter(hosts).reduce((sum, student) => sum + Number(student.maxGuests || 0), 0)
    const travelers = visitors.filter(travels).length
    if (capacity < travelers) conflicts.push(`Capacité d’accueil insuffisante ${label} (${capacity}/${travelers}).`)
    else respected.push(`Capacité d’accueil suffisante ${label}`)
  }
  if (bercher.length && brugg.length) {
    checkHosting(bercher, brugg, 'à Bercher')
    checkHosting(brugg, bercher, 'à Brugg')
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

    if (student.participation === 'declined') conflicts.push(`${fullName(student)} ne participe pas et n’accueille pas.`)
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
    if (student.notes) warnings.push(`Remarque confidentielle à vérifier pour ${fullName(student)}.`)
    if (student.status === 'review') warnings.push(`Fiche incomplète pour ${fullName(student)}.`)
  }

  const regularLinks = members.filter((student) => {
    const others = student.side === 'bercher' ? brugg : bercher
    return others.some((other) => normalized(student.regularCorrespondents).includes(normalized(fullName(other))))
  }).length
  if (regularLinks && !conflicts.length) respected.push('Lien de correspondance existant valorisé')
  if (!regularLinks && members.length) warnings.push('Aucun lien de correspondance existant détecté.')

  const score = Math.max(0, Math.min(100, 100 - conflicts.length * 28 - warnings.length * 6 + Math.min(regularLinks * 3, 6)))
  return { score, respected: [...new Set(respected)], warnings: [...new Set(warnings)], conflicts: [...new Set(conflicts)] }
}

export function scenarioStats(scenario, students) {
  const studentIds = new Set(students.map((student) => student.id))
  const assigned = new Set(scenario.pairings.flatMap((pairing) => pairing.memberIds).filter((id) => studentIds.has(id)))
  const eligible = students.filter((student) => student.participation !== 'declined')
  const alertCount = scenario.pairings.filter((pairing) => evaluatePairing(pairing.memberIds, students).conflicts.length).length
  const groupA = scenario.pairings.flatMap((pairing) => pairing.memberIds.map((id) => ({ id, rotation: pairing.rotation }))).filter((item) => item.rotation === 'A').length
  const groupB = scenario.pairings.flatMap((pairing) => pairing.memberIds.map((id) => ({ id, rotation: pairing.rotation }))).filter((item) => item.rotation === 'B').length
  return { assigned: assigned.size, unassigned: eligible.filter((student) => !assigned.has(student.id)).length, alertCount, groupA, groupB }
}
