import { describe, expect, it } from 'vitest'
import { calculateClassBalances } from './classBalance.js'
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

  it('spreads flexible suggestions across the two blocks and limits class differences', () => {
    const students = Array.from({ length: 4 }, (_, index) => [
      { ...base, id: `b${index}`, side: 'bercher', name: `Élève Bercher ${index}`, school: 'VP', className: '11VP1', gender: 'female' },
      { ...base, id: `r${index}`, side: 'brugg', name: `Élève Brugg ${index}`, school: 'Bezirksschule', className: 'B1', gender: 'female' },
    ]).flat()
    const suggestions = findOptimalPairings(students)
    expect(suggestions.filter((pairing) => pairing.rotation === 'A')).toHaveLength(2)
    expect(suggestions.filter((pairing) => pairing.rotation === 'B')).toHaveLength(2)
    const { balances } = calculateClassBalances({ pairings: suggestions }, students)
    expect(Math.max(...balances.flatMap((row) => [Math.abs(row.first.net), Math.abs(row.second.net)]))).toBe(0)
  })

  it('uses the existing groups when choosing a flexible block', () => {
    const students = [
      { ...base, id: 'old-b', side: 'bercher', name: 'Ancien Bercher', school: 'VP', className: '11VP1', gender: 'female' },
      { ...base, id: 'old-r', side: 'brugg', name: 'Ancien Brugg', school: 'Bezirksschule', className: 'B1', gender: 'female' },
      { ...base, id: 'new-b', side: 'bercher', name: 'Nouveau Bercher', school: 'VP', className: '11VP2', gender: 'female' },
      { ...base, id: 'new-r', side: 'brugg', name: 'Nouveau Brugg', school: 'Bezirksschule', className: 'B2', gender: 'female' },
    ]
    const suggestions = findOptimalPairings(students, new Set(['old-b', 'old-r']), [{ memberIds: ['old-b', 'old-r'], rotation: 'A', bercherHostClass: '11VP1', bruggHostClass: 'B1' }])
    expect(suggestions[0].rotation).toBe('B')
  })
})
