import { describe, expect, it } from 'vitest'
import { evaluatePairing, fullName, getCorrespondentStatus, hostCapacity, isStudentEnrollmentComplete, normalizeSchool, scenarioStats } from './compatibility.js'

const base = { participation: 'exchange_and_host', canHost: true, acceptsOtherGender: true, conditionType: 'none', rotation: 'A', notes: '', status: 'complete' }

describe('evaluatePairing', () => {
  it('accepts a reciprocal one-to-one match', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts).toEqual([])
  })

  it('retains a legacy pair with insufficient hosting and marks the missing place', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', school: 'Bercher', className: '11VG1', firstName: 'A', lastName: 'B', gender: 'female', canHost: false, participation: 'travel_no_host', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', school: 'Sekundarschule', className: 'S1', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students)).toMatchObject({
      conflicts: [],
      warnings: expect.arrayContaining([expect.stringContaining('Accueil à Bercher')]),
      hosting: {
        bercher: { required: 1, available: 0, sufficient: false },
        brugg: { required: 1, available: 1, sufficient: true },
      },
    })
  })

  it('defaults old hosting records to one place and disregards capacity when the student cannot host', () => {
    expect(hostCapacity(base)).toBe(1)
    expect(hostCapacity({ ...base, hostCapacity: 3 })).toBe(3)
    expect(hostCapacity({ ...base, hostCapacity: '2' })).toBe(2)
    expect(hostCapacity({ ...base, hostCapacity: 2.5 })).toBe(1)
    expect(hostCapacity({ ...base, hostCapacity: 3, canHost: false })).toBe(0)
    expect(hostCapacity({ ...base, hostCapacity: 3, participation: 'travel_no_host' })).toBe(0)
  })

  it('sums declared hosting places for a group and blocks a shortage at either school', () => {
    const left = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', hostCapacity: 2 }
    const right = { ...base, id: 'r1', side: 'brugg', name: 'Nora Keller' }
    const third = { ...base, id: 'r2', side: 'brugg', name: 'Zoé Weber', participation: 'travel_no_host' }
    const ids = [left.id, right.id, third.id]
    expect(evaluatePairing(ids, [{ ...left, hostCapacity: 1 }, right, third]).conflicts).toEqual([
      expect.stringContaining('1 place pour 2 élèves'),
    ])
    expect(evaluatePairing(ids, [left, right, third])).toMatchObject({
      conflicts: [],
      hosting: {
        bercher: { required: 2, available: 2, sufficient: true },
        brugg: { required: 1, available: 1, sufficient: true },
      },
    })
    expect(evaluatePairing(ids, [left, { ...right, canHost: false }, third]).conflicts).toEqual([
      expect.stringContaining('Accueil à Brugg'),
    ])
  })

  it('treats VP to Bezirk and VG to Sekundar as a soft preference', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', school: 'Bercher', className: '11VP1', firstName: 'A', lastName: 'B', gender: 'female', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', school: 'Sekundarschule', className: 'S1', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    const result = evaluatePairing(['b', 'r'], students)
    expect(result.conflicts).toEqual([])
    expect(result.warnings.join(' ')).toContain('préférence seulement')
  })

  it('enforces a named partner', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', conditionType: 'named_only', namedPartner: 'Quelqu’un d’autre', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('condition sine qua non')
  })

  it('detects whether the named correspondent was added', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'Alice', lastName: 'Martin', regularCorrespondents: 'Léa Müller' },
      { ...base, id: 'r', side: 'brugg', firstName: 'Léa', lastName: 'Müller', regularCorrespondents: '' },
    ]
    expect(getCorrespondentStatus(students[0], students)).toMatchObject({ state: 'found', method: 'exact' })
    expect(getCorrespondentStatus({ ...students[0], regularCorrespondents: 'Personne absente' }, students).state).toBe('missing')
  })

  it('recognizes additional given names, surnames entered first and a minor typo', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', conditionType: 'regular_only', regularCorrespondents: 'Müler, Clara' }
    const brugg = { ...base, id: 'r', side: 'brugg', name: 'Clara Sophie Müller' }
    const students = [bercher, brugg]
    const status = getCorrespondentStatus(bercher, students)
    expect(status).toMatchObject({ state: 'found', method: 'approximate', student: brugg })
    expect(evaluatePairing(['b', 'r'], students, 'A')).toMatchObject({ conflicts: [] })
    expect(evaluatePairing(['b', 'r'], students, 'A').warnings.join(' ')).toContain('reconnu par rapprochement')
    expect(evaluatePairing(['b', 'r'], students, 'A').memberConditions.b.partner).toBe('review')
  })

  it('reports the checks for each pupil in the group', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', gender: 'female', acceptsOtherGender: false, requiredRotation: 'A', conditionType: 'regular_only', regularCorrespondents: 'Zoé Weber' }
    const brugg = { ...base, id: 'r', side: 'brugg', name: 'Zoé Weber', gender: 'female', requiredRotation: 'B', acceptsOtherGender: true }
    expect(evaluatePairing(['b', 'r'], [bercher, brugg], 'A').memberConditions).toEqual({
      b: { gender: 'pass', rotation: 'pass', partner: 'pass' },
      r: { gender: null, rotation: 'fail' },
    })
    expect(evaluatePairing(['b', 'r'], [bercher, { ...brugg, gender: 'male' }], '').memberConditions.b)
      .toMatchObject({ gender: 'fail', rotation: 'review' })
  })

  it('resolves each listed usual correspondent and evaluates a match with any of them', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', conditionType: 'regular_only', regularCorrespondents: 'Nora Keller, Zoé Weber\nPersonne absente' }
    const students = [bercher,
      { ...base, id: 'r1', side: 'brugg', name: 'Nora Keller' },
      { ...base, id: 'r2', side: 'brugg', name: 'Zoé Weber' },
    ]
    const status = getCorrespondentStatus(bercher, students)
    expect(status.matches.map((match) => match.student.id)).toEqual(['r1', 'r2'])
    expect(status.missingNames).toEqual(['Personne absente'])
    expect(evaluatePairing(['b', 'r2'], students, 'A').conflicts).toEqual([])
  })

  it('keeps two separate correspondents even if both entries form a third name', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', regularCorrespondents: 'Nora, Zoé Weber' }
    const students = [
      bercher,
      { ...base, id: 'r1', side: 'brugg', name: 'Nora' },
      { ...base, id: 'r2', side: 'brugg', name: 'Zoé Weber' },
      { ...base, id: 'r3', side: 'brugg', name: 'Nora Zoé Weber' },
    ]
    expect(getCorrespondentStatus(bercher, students).matches.map(({ student }) => student.id)).toEqual(['r1', 'r2'])
  })

  it('checks the third correspondent for both usual-partner conditions', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', conditionType: 'regular_only', regularCorrespondents: 'Nora Keller, Sina Roth, Zoé Weber' }
    const brugg = { ...base, id: 'r', side: 'brugg', name: 'Zoé Weber', regularCorrespondents: 'Alice Martin' }
    expect(evaluatePairing(['b', 'r'], [bercher, brugg], 'A')).toMatchObject({ conflicts: [], usualStatus: 'mutual', regularLinks: 2 })
    expect(evaluatePairing(['b', 'r'], [{ ...bercher, conditionType: 'different_only' }, brugg], 'A').conflicts).toEqual(['Alice Martin ne veut pas être avec Zoé Weber.'])
  })

  it('prefers exact matches and reports ties across the full opposite roster', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', conditionType: 'regular_only', regularCorrespondents: 'Clara Müller' }
    const brugg = { ...base, id: 'r1', side: 'brugg', name: 'Clara Sophie Müller' }
    const otherBrugg = { ...base, id: 'r2', side: 'brugg', name: 'Clara Anna Muller', active: false }
    const sameSide = { ...base, id: 'b2', side: 'bercher', name: 'Clara Müller' }
    const students = [bercher, brugg, otherBrugg, sameSide]
    expect(getCorrespondentStatus(bercher, students)).toMatchObject({ state: 'ambiguous', student: null, candidates: [brugg, otherBrugg] })
    expect(evaluatePairing(['b', 'r1'], students, 'A').usualStatus).toBe('ambiguous')
    expect(evaluatePairing(['b', 'r1'], students, 'A').conditions.indispensable).toContainEqual({ state: 'review', label: expect.stringContaining('Plusieurs élèves') })
    const exact = { ...base, id: 'r3', side: 'brugg', name: 'Clara Muller' }
    expect(getCorrespondentStatus(bercher, [...students, exact])).toMatchObject({ state: 'found', method: 'exact', student: exact })
  })

  it('distinguishes reciprocal, one-sided, different and unknown usual correspondents', () => {
    const left = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', regularCorrespondents: 'Nora Keller' }
    const right = { ...base, id: 'r', side: 'brugg', name: 'Nora Marie Keller', regularCorrespondents: 'Alice Martin' }
    const other = { ...base, id: 'r2', side: 'brugg', name: 'Zoé Weber' }
    expect(evaluatePairing(['b', 'r'], [left, right])).toMatchObject({ usualStatus: 'mutual', regularLinks: 2 })
    expect(evaluatePairing(['b', 'r'], [left, { ...right, regularCorrespondents: '' }])).toMatchObject({ usualStatus: 'partial', regularLinks: 1 })
    expect(evaluatePairing(['b', 'r2'], [left, right, other])).toMatchObject({ usualStatus: 'different', regularLinks: 0 })
    expect(evaluatePairing(['b', 'r2'], [left, other])).toMatchObject({ usualStatus: 'unknown', regularLinks: 0 })
  })

  it('rejects the usual correspondent entered with a typo when a different partner is required', () => {
    const bercher = { ...base, id: 'b', side: 'bercher', name: 'Alice Martin', conditionType: 'different_only', regularCorrespondents: 'Nora Kellre' }
    const brugg = { ...base, id: 'r', side: 'brugg', name: 'Nora Keller' }
    const students = [bercher, brugg]
    expect(getCorrespondentStatus(bercher, students)).toMatchObject({ state: 'found', method: 'approximate' })
    expect(evaluatePairing(['b', 'r'], students, 'A').conflicts.join(' ')).toContain('ne veut pas être avec')
  })

  it('recognizes the four school tracks and the single-name format', () => {
    expect(normalizeSchool('Bercher', '11VP2', 'bercher')).toBe('VP')
    expect(normalizeSchool('Bercher', '11VG1', 'bercher')).toBe('VG')
    expect(normalizeSchool('', 'B2', 'brugg')).toBe('Bezirksschule')
    expect(normalizeSchool('', 'S2', 'brugg')).toBe('Sekundarschule')
    expect(fullName({ name: 'Léa Müller', firstName: 'Ancien', lastName: 'Format' })).toBe('Léa Müller')
  })

  it('considère une fiche complète dès que les cinq renseignements attendus sont présents', () => {
    const core = { name: 'Léa Martin', school: 'VP', className: '11VP1', gender: 'female', regularCorrespondents: 'Nora Keller' }
    expect(isStudentEnrollmentComplete(core)).toBe(true)
    expect(isStudentEnrollmentComplete({ ...core, regularCorrespondents: '' })).toBe(false)
    expect(isStudentEnrollmentComplete({ ...core, gender: 'unspecified' })).toBe(false)
  })

  it('does not count host-only pupils as pupils to place', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', participation: 'host_only', name: 'Hôte Bercher', gender: 'female' },
      { ...base, id: 'r', side: 'brugg', name: 'Voyageur Brugg', gender: 'male' },
    ]
    expect(scenarioStats({ pairings: [] }, students).unassigned).toBe(1)
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('ne participe pas au déplacement')
  })

  it('makes a requested group indispensable only when the pairing is placed in the other block', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', name: 'Léa Martin', gender: 'female', requiredRotation: 'A' },
      { ...base, id: 'r', side: 'brugg', name: 'Nora Keller', gender: 'female' },
    ]
    expect(evaluatePairing(['b', 'r'], students, 'A').conflicts).toEqual([])
    expect(evaluatePairing(['b', 'r'], students, 'B').conflicts.join(' ')).toContain('ne peut pas être dans le groupe B')
  })

  it('keeps optional conditions separate from indispensable conflicts', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', school: 'VP', className: '11VP1', name: 'Léa Martin', gender: 'female', regularCorrespondents: 'Nora Keller' },
      { ...base, id: 'r', side: 'brugg', school: 'Bezirksschule', className: 'B1', name: 'Nora Keller', gender: 'female', regularCorrespondents: 'Léa Martin' },
    ]
    const result = evaluatePairing(['b', 'r'], students, 'A')
    expect(result.conditions.indispensable.some((item) => item.label === 'Les deux élèves sont correspondants de base.')).toBe(true)
    expect(result.conditions.optional.some((item) => item.label.includes('filières privilégiées'))).toBe(true)
  })

  it('keeps other useful information outside matching conditions', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', school: 'VG', className: '11VG1', name: 'Léa Martin', gender: 'female', otherInfo: 'Allergie à signaler.' },
      { ...base, id: 'r', side: 'brugg', school: 'Sekundarschule', className: 'S1', name: 'Nora Keller', gender: 'female', otherInfo: 'Transport particulier.' },
    ]
    const result = evaluatePairing(['b', 'r'], students, 'A')
    expect(result.conditions.optional.map((item) => item.label).join(' ')).not.toContain('Autres infos utiles')
  })

  it('treats a refused pupil as unavailable without deleting their record', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', name: 'Léa Martin', gender: 'female', active: false },
      { ...base, id: 'r', side: 'brugg', name: 'Nora Keller', gender: 'female' },
    ]
    expect(scenarioStats({ pairings: [] }, students).unassigned).toBe(1)
    expect(evaluatePairing(['b', 'r'], students, 'A').conflicts.join(' ')).toContain('retiré de l’échange')
  })

  it('uses the decision in the evaluated scenario even when a legacy status differs', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', name: 'Léa Martin', active: false },
      { ...base, id: 'r', side: 'brugg', name: 'Nora Keller' },
    ]
    const accepted = { pairings: [], exchangeDecisions: { b: 'maintained' } }
    const rejected = { pairings: [], exchangeDecisions: { b: 'declined' } }
    expect(scenarioStats(accepted, students).unassigned).toBe(2)
    expect(scenarioStats(rejected, students).unassigned).toBe(1)
    expect(evaluatePairing(['b', 'r'], students, 'A', accepted).conflicts).toEqual([])
    expect(evaluatePairing(['b', 'r'], students, 'A', rejected).conflicts.join(' ')).toContain('retiré de l’échange')
  })
})
