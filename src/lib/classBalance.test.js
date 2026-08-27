import { describe, expect, it } from 'vitest'
import { calculateClassBalances, calculateClassMovementDetails } from './classBalance.js'

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

  it('détaille les élèves absents et supplémentaires pour chaque classe', () => {
    const students = [
      { ...student('b1', 'bercher', 'VP', '11VP1'), name: 'Léa Martin' },
      { ...student('r1', 'brugg', 'Bezirksschule', 'B1'), name: 'Nora Keller' },
    ]
    const { classes } = calculateClassMovementDetails({ pairings: [{ memberIds: ['b1', 'r1'], rotation: 'A' }] }, students)
    const bercher = classes.find((row) => row.className === '11VP1')
    const brugg = classes.find((row) => row.className === 'B1')
    expect(bercher.first.outgoing.map((student) => student.name)).toEqual(['Léa Martin'])
    expect(bercher.second.incoming.map((student) => student.name)).toEqual(['Nora Keller'])
    expect(brugg.first.incoming.map((student) => student.name)).toEqual(['Léa Martin'])
    expect(brugg.second.outgoing.map((student) => student.name)).toEqual(['Nora Keller'])
  })
})
