import { describe, expect, it } from 'vitest'
import { calculateClassBalances } from './classBalance.js'

const student = (id, side, school, className) => ({ id, side, school, className })

describe('calculateClassBalances', () => {
  it('calcule les départs, arrivées et soldes des deux parties', () => {
    const students = [
      student('b1', 'bercher', 'Bercher', '11VP1'),
      student('b2', 'bercher', 'Bercher', '11VP1'),
      student('b3', 'bercher', 'Bercher', '11VP1'),
      student('r1', 'brugg', 'Bezirksschule', 'B1'),
      student('r2', 'brugg', 'Bezirksschule', 'B1'),
    ]
    const scenario = { pairings: [
      { memberIds: ['b1', 'b2', 'r1'], rotation: 'A' },
      { memberIds: ['b3', 'r2'], rotation: 'B' },
    ] }

    const { balances } = calculateClassBalances(scenario, students)
    const bercher = balances.find((row) => row.className === '11VP1')
    expect(bercher.first).toEqual({ outgoing: 2, incoming: 1, net: -1 })
    expect(bercher.second).toEqual({ outgoing: 1, incoming: 1, net: 0 })
  })

  it('signale les groupes dont la rotation reste à décider', () => {
    const students = [student('b1', 'bercher', 'Bercher', '11VG1'), student('r1', 'brugg', 'Sekundarschule', 'S1')]
    const result = calculateClassBalances({ pairings: [{ memberIds: ['b1', 'r1'], rotation: '' }] }, students)
    expect(result.undecidedPairings).toBe(1)
    expect(result.balances.every((row) => row.first.net === 0 && row.second.net === 0)).toBe(true)
  })
})
