import { createPairingEvaluator } from './compatibility.js'
import { isMaintainedInScenario } from './scenarioParticipation.js'

export const canConfirmPairing = (result, rotation) => ['A', 'B'].includes(rotation)
  && result.conditions.indispensable.every(({ state }) => state === 'pass')
  && Object.values(result.hosting).every(({ sufficient }) => sufficient)

export function canAppendPairings(scenario, pairings, students, confirm = false) {
  if (!scenario || !pairings.length) return false
  const byId = new Map(students.map((student) => [student.id, student]))
  const occupied = new Set(scenario.pairings.flatMap((pairing) => pairing.memberIds))
  const evaluate = confirm ? createPairingEvaluator(students, scenario) : null

  return pairings.every(({ memberIds, rotation }) => {
    const sides = new Set()
    for (const id of memberIds) {
      const student = byId.get(id)
      if (!student || occupied.has(id) || !isMaintainedInScenario(student, scenario)) return false
      occupied.add(id)
      sides.add(student.side)
    }
    return sides.has('bercher') && sides.has('brugg')
      && (!evaluate || canConfirmPairing(evaluate(memberIds, rotation), rotation))
  })
}
