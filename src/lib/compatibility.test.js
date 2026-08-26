import { describe, expect, it } from 'vitest'
import { evaluatePairing } from './compatibility.js'

const base = { participation: 'exchange_and_host', canHost: true, maxGuests: 1, acceptsOtherGender: true, conditionType: 'none', rotation: 'A', notes: '', status: 'complete' }

describe('evaluatePairing', () => {
  it('accepts a reciprocal one-to-one match', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts).toEqual([])
  })

  it('blocks insufficient hosting capacity', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', canHost: false, maxGuests: 0, participation: 'travel_no_host', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('Bercher')
  })

  it('enforces a named partner', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', conditionType: 'named_only', namedPartner: 'Quelqu’un d’autre', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('personne imposée')
  })
})
