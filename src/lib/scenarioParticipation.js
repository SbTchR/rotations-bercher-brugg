export const scenarioDecisionLabels = {
  pending: 'À décider',
  maintained: 'Maintenu',
  declined: 'Refusé',
}

export function getScenarioDecision(student, scenario) {
  if (!scenario?.exchangeDecisions) {
    if (student.active === false) return 'declined'
    if (student.active === true) return 'maintained'
    return 'pending'
  }
  const decision = scenario.exchangeDecisions[student.id]
  return decision === 'maintained' || decision === 'declined' ? decision : 'pending'
}

export const isMaintainedInScenario = (student, scenario) => getScenarioDecision(student, scenario) !== 'declined'

export function normalizeScenarioDecisions(scenarios, students) {
  const legacyDecisions = Object.fromEntries(students
    .filter((student) => typeof student.active === 'boolean')
    .map((student) => [student.id, student.active ? 'maintained' : 'declined']))

  return scenarios.map((scenario) => ({
    ...scenario,
    exchangeDecisions: scenario.exchangeDecisions ?? { ...legacyDecisions },
  }))
}

export function removeStudentsFromPairings(pairings, studentsById, removedIds) {
  return pairings.flatMap((pairing) => {
    if (!pairing.memberIds.some((id) => removedIds.has(id))) return [pairing]
    const memberIds = pairing.memberIds.filter((id) => !removedIds.has(id))
    const members = memberIds.map((id) => studentsById.get(id)).filter(Boolean)
    if (!members.some((student) => student.side === 'bercher') || !members.some((student) => student.side === 'brugg')) return []
    const hostClasses = {}
    for (const [side, field] of [['bercher', 'bercherHostClass'], ['brugg', 'bruggHostClass']]) {
      const sideMembers = members.filter((student) => student.side === side)
      if (pairing[field] && !sideMembers.some((student) => student.className === pairing[field])) {
        hostClasses[field] = ''
      }
    }
    return [{ ...pairing, ...hostClasses, memberIds, locked: false }]
  })
}

export function updateScenarioDecision(scenario, studentId, decision, studentsById) {
  const exchangeDecisions = { ...scenario.exchangeDecisions }
  if (decision === 'pending') delete exchangeDecisions[studentId]
  else exchangeDecisions[studentId] = decision

  return {
    ...scenario,
    exchangeDecisions,
    pairings: decision === 'declined'
      ? removeStudentsFromPairings(scenario.pairings, studentsById, new Set([studentId]))
      : scenario.pairings,
    updatedAt: new Date().toISOString(),
  }
}
