import { describe, expect, it } from 'vitest'
import { findOptimalPairings } from './matchingAlgorithm.js'

const base = {
  active: true,
  participation: 'exchange_and_host',
  acceptsOtherGender: true,
  conditionType: 'none',
  regularCorrespondents: '',
  namedPartner: '',
  requiredRotation: '',
  status: 'complete',
}

describe('findOptimalPairings', () => {
  it('maximizes the number of valid pairs instead of taking the first local optimum', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice', school: 'VP', className: '11VP1', gender: 'female' },
      { ...base, id: 'b2', side: 'bercher', name: 'Béatrice', school: 'VP', className: '11VP2', gender: 'female', conditionType: 'named_only', namedPartner: 'Rita' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita', school: 'Bezirksschule', className: 'B1', gender: 'female' },
      { ...base, id: 'r2', side: 'brugg', name: 'Sarah', school: 'Sekundarschule', className: 'S1', gender: 'female' },
    ]
    const result = findOptimalPairings(students)
    expect(result).toHaveLength(2)
    expect(result.find((pairing) => pairing.memberIds.includes('b2'))?.memberIds).toContain('r1')
  })

  it('chooses the block that satisfies an indispensable group condition', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice', school: 'VG', className: '11VG1', gender: 'female', requiredRotation: 'B' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita', school: 'Sekundarschule', className: 'S1', gender: 'female' },
    ]
    expect(findOptimalPairings(students)[0].rotation).toBe('B')
  })

  it('ignores inactive, host-only and already assigned pupils', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice', gender: 'female' },
      { ...base, id: 'b2', side: 'bercher', name: 'Béatrice', gender: 'female', active: false },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita', gender: 'female' },
      { ...base, id: 'r2', side: 'brugg', name: 'Sarah', gender: 'female', participation: 'host_only' },
    ]
    expect(findOptimalPairings(students, new Set(['b1']))).toEqual([])
  })
})
