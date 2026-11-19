import { describe, expect, it } from 'vitest'
import { canAppendPairings } from './pairingBatch'

const pupil = (id, side, details = {}) => ({
  id, side, name: id, gender: 'female', acceptsOtherGender: true,
  participation: 'exchange_and_host', canHost: true, conditionType: 'none', ...details,
})

const students = [
  pupil('b1', 'bercher'),
  pupil('b2', 'bercher', { participation: 'travel_no_host' }),
  pupil('r1', 'brugg', { hostCapacity: 2 }),
  pupil('r2', 'brugg'),
]
const scenario = { pairings: [], exchangeDecisions: {} }
const pairing = (...memberIds) => ({ memberIds, rotation: 'A' })

describe('validation du lot de groupes', () => {
  it('rejette tout le lot quand un élève y figure deux fois', () => {
    expect(canAppendPairings(scenario, [pairing('b1', 'r1'), pairing('b1', 'r2')], students, true)).toBe(false)
    const existing = { ...scenario, pairings: [pairing('b1', 'r1')] }
    expect(canAppendPairings(existing, [pairing('b2', 'b1', 'r2')], students, true)).toBe(false)
  })

  it('confirme seulement les groupes dont l’accueil est couvert dans les deux écoles', () => {
    expect(canAppendPairings(scenario, [pairing('b2', 'r1')], students)).toBe(true)
    expect(canAppendPairings(scenario, [pairing('b2', 'r1')], students, true)).toBe(false)
    expect(canAppendPairings(scenario, [pairing('b1', 'b2', 'r1')], students, true)).toBe(true)
    expect(canAppendPairings(scenario, [pairing('b1', 'b2', 'r2')], students, true)).toBe(false)
  })
})
