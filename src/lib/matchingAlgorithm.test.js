import { describe, expect, it } from 'vitest'
import { calculateClassBalances } from './classBalance.js'
import { computeProvisionalPlan, findOptimalPairings } from './matchingAlgorithm.js'

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

  it('prioritizes reciprocal hosting over usual correspondents and extra one-sided pairs', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice Martin', gender: 'female' },
      { ...base, id: 'b2', side: 'bercher', name: 'Béatrice Morel', gender: 'female', participation: 'travel_no_host', regularCorrespondents: 'Rita Weiss' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita Weiss', gender: 'female', regularCorrespondents: 'Béatrice Morel' },
      { ...base, id: 'r2', side: 'brugg', name: 'Sarah Keller', gender: 'female', canHost: false, regularCorrespondents: 'Alice Martin' },
    ]
    expect(findOptimalPairings(students).map((pairing) => pairing.memberIds)).toEqual([['b1', 'r1']])
  })

  it('never automatically assigns a one-sided pair', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice Martin', gender: 'female', participation: 'travel_no_host' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita Weiss', gender: 'female' },
    ]
    expect(findOptimalPairings(students)).toEqual([])
    expect(findOptimalPairings([students[0], { ...students[1], canHost: false }])).toEqual([])
  })

  it('takes the eligibility decision from the selected scenario', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice Martin', gender: 'female' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita Weiss', gender: 'female', active: false },
    ]
    expect(findOptimalPairings(students, undefined, undefined, { exchangeDecisions: { r1: 'declined' } })).toEqual([])
    expect(findOptimalPairings(students, undefined, undefined, { exchangeDecisions: { r1: 'maintained' } })).toHaveLength(1)
  })

  it('keeps a required usual correspondent eligible when a typo is recognized', () => {
    const students = [
      { ...base, id: 'b1', side: 'bercher', name: 'Alice Martin', gender: 'female', conditionType: 'regular_only', regularCorrespondents: 'Ritta Weiss' },
      { ...base, id: 'r1', side: 'brugg', name: 'Rita Weiss', gender: 'female' },
      { ...base, id: 'r2', side: 'brugg', name: 'Rita Keller', gender: 'female' },
    ]
    expect(findOptimalPairings(students).map((pairing) => pairing.memberIds)).toEqual([['b1', 'r1']])
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

const pupil = (id, side, name, overrides = {}) => ({
  ...base,
  id,
  side,
  name,
  school: side === 'bercher' ? 'VP' : 'Bezirksschule',
  className: side === 'bercher' ? '11VP1' : 'B1',
  gender: 'female',
  ...overrides,
})

const membersOf = (pairings) => pairings.map((pairing) => [...pairing.memberIds].sort())
const scenario = { pairings: [] }

describe('computeProvisionalPlan', () => {
  const alice = pupil('a', 'bercher', 'Alice Martin', { participation: 'travel_no_host', regularCorrespondents: 'Rita Weiss' })
  const bea = pupil('b', 'bercher', 'Béatrice Morel')
  const rita = pupil('r', 'brugg', 'Rita Weiss', { regularCorrespondents: 'Alice Martin', hostCapacity: 2 })

  it('separates a blocked usual duo, a feasible trio and a complete alternative', () => {
    const students = [alice, bea, rita]
    const plan = computeProvisionalPlan(students, scenario)
    expect(plan.ordinaryPairings).toEqual([])
    expect(plan.reviewItems).toHaveLength(1)
    const { options } = plan.reviewItems.find((item) => item.studentId === alice.id)
    const trio = options.find((option) => option.kind === 'trio')
    expect(trio.pairing.memberIds).toEqual(['a', 'b', 'r'])
    expect(trio.impact).toMatchObject({ placed: 3, fullExchange: 0, unplaced: 0 })
    expect(trio.pairing.result.hosting).toMatchObject({ bercher: { available: 1, required: 1 }, brugg: { available: 2, required: 2 } })
    const complete = options.find((option) => option.kind === 'ordinary')
    expect(complete.pairing.memberIds).toEqual(['b', 'r'])
    expect(complete.impact).toMatchObject({ placed: 2, fullExchange: 2, unplaced: 1 })
    const blocked = options.find((option) => option.kind === 'blocked')
    expect(blocked).toMatchObject({ selectable: false, impact: null, reason: expect.stringContaining('Accueil à Bercher insuffisant') })
    const accepted = computeProvisionalPlan(students, scenario, { fixedPairings: [trio.pairing] })
    expect(membersOf(accepted.fixedPairings)).toEqual([['a', 'b', 'r']])
    expect(accepted.reviewItems).toEqual([])
    expect(accepted.unplaced).toEqual([])
    expect(accepted.summary.placed).toBe(3)
  })

  it('keeps hosting capacity and indispensable A/B constraints during recalculation', () => {
    const limitedRita = { ...rita, hostCapacity: 1 }
    const plan = computeProvisionalPlan([alice, bea, limitedRita], scenario)
    expect(plan.reviewItems.flatMap((item) => item.options).some((option) => option.kind === 'trio')).toBe(false)
    const unresolvable = computeProvisionalPlan([{ ...alice, requiredRotation: 'A' }, bea, { ...rita, requiredRotation: 'B' }], scenario)
    expect(unresolvable.reviewItems.flatMap((item) => item.options).some((option) => option.kind === 'trio')).toBe(false)

    const invalid = computeProvisionalPlan([alice, bea, limitedRita], scenario, { fixedPairings: [{ memberIds: ['a', 'b', 'r'], rotation: 'A' }] })
    expect(invalid.fixedPairings).toEqual([])
    expect(invalid.invalidFixedPairings[0].reason).toContain('Accueil à Brugg insuffisant')
  })

  it('reports a blocked group for pupils without any alternative and honors deferral', () => {
    const blocked = computeProvisionalPlan([alice, rita], scenario)
    expect(blocked.reviewItems).toEqual([])
    expect(blocked.unplaced.find((item) => item.studentId === 'a')?.options[0]).toMatchObject({ kind: 'blocked', selectable: false })
    const deferred = computeProvisionalPlan([alice, bea, rita], scenario, { deferredStudentIds: new Set(['a']) })
    expect(deferred.deferred.map((item) => item.studentId)).toEqual(['a'])
    expect(deferred.reviewItems.flatMap((item) => item.options).filter((option) => option.selectable).some((option) => option.pairing.memberIds.includes('a'))).toBe(false)
  })

  it('preserves clean ordinary groups when possible and shows the cost of an alternative elsewhere', () => {
    const vested = { ...rita, regularCorrespondents: '' }
    const celine = pupil('c', 'bercher', 'Céline Aubert', { school: 'VG', className: '11VG2' })
    const sarah = pupil('s', 'brugg', 'Sarah Keller', { school: 'Sekundarschule', className: 'S1' })
    const students = [alice, bea, celine, vested, sarah]
    const plan = computeProvisionalPlan(students, scenario)
    expect(membersOf(plan.ordinaryPairings)).toEqual(expect.arrayContaining([['b', 'r'], ['c', 's']]))
    const options = plan.reviewItems.find((item) => item.studentId === 'a').options
    const best = options[0]
    expect(best.kind).toBe('trio')
    expect(best.impact).toMatchObject({ placed: 5, displacedStudentIds: [] })
    const other = options.find((option) => option.kind === 'trio' && option.pairing.memberIds.includes('c'))
    expect(other.impact).toMatchObject({ placed: 3, displacedStudentIds: expect.arrayContaining(['b', 's']) })
    const accepted = computeProvisionalPlan(students, scenario, { fixedPairings: [other.pairing] })
    expect(accepted.summary.placed).toBe(other.impact.placed)
    expect(accepted.ordinaryPairings).toEqual([])
  })

  it('uses a missing name field as neutral but separates incomplete data and mismatched tracks', () => {
    const standaloneRita = { ...rita, regularCorrespondents: '' }
    const noUsual = { ...bea, status: 'review' }
    expect(membersOf(computeProvisionalPlan([noUsual, standaloneRita], scenario).ordinaryPairings)).toEqual([['b', 'r']])
    for (const special of [{ ...noUsual, className: '' }, { ...noUsual, school: 'VG', className: '11VG1' }]) {
      const plan = computeProvisionalPlan([special, standaloneRita], scenario)
      expect(plan.ordinaryPairings).toEqual([])
      expect(plan.reviewItems[0].options[0].selectable).toBe(true)
      expect(plan.reviewItems[0].options[0].kind).toBe('ordinary')
    }
  })

  it('keeps known usual links ahead of soft preferences within cardinality and respects existing groups', () => {
    const louis = pupil('b1', 'bercher', 'Louis Bonnet', { regularCorrespondents: 'Max Keller' })
    const lucas = pupil('b2', 'bercher', 'Lucas Patt', { school: 'VG', className: '11VG2' })
    const max = pupil('r1', 'brugg', 'Max Keller', { school: 'Sekundarschule', className: 'S1' })
    const matthias = pupil('r2', 'brugg', 'Matthias Klein')
    const students = [louis, lucas, max, matthias]
    expect(membersOf(findOptimalPairings(students))).toEqual(expect.arrayContaining([['b1', 'r1'], ['b2', 'r2']]))

    const saved = { pairings: [{ memberIds: ['b1', 'r1'], rotation: 'A' }] }
    const plan = computeProvisionalPlan(students, saved, { fixedPairings: saved.pairings })
    expect(plan.invalidFixedPairings).toHaveLength(1)
    expect(plan.ordinaryPairings).toEqual([])
    expect(plan.reviewItems[0].options[0].pairing.memberIds).toEqual(['b2', 'r2'])
  })
})
