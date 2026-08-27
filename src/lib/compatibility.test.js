import { describe, expect, it } from 'vitest'
import { evaluatePairing, fullName, getCorrespondentStatus, normalizeSchool, scenarioStats } from './compatibility.js'

const base = { participation: 'exchange_and_host', canHost: true, acceptsOtherGender: true, conditionType: 'none', rotation: 'A', notes: '', status: 'complete' }

describe('evaluatePairing', () => {
  it('accepts a reciprocal one-to-one match', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'A', lastName: 'B', gender: 'female', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts).toEqual([])
  })

  it('does not use hosting ability as a compatibility criterion', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', school: 'Bercher', className: '11VG1', firstName: 'A', lastName: 'B', gender: 'female', canHost: false, participation: 'travel_no_host', regularCorrespondents: '' },
      { ...base, id: 'r', side: 'brugg', school: 'Sekundarschule', className: 'S1', firstName: 'C', lastName: 'D', gender: 'female', regularCorrespondents: '' },
    ]
    expect(evaluatePairing(['b', 'r'], students).conflicts).toEqual([])
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
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('personne imposée')
  })

  it('detects whether the named correspondent was added', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', firstName: 'Alice', lastName: 'Martin', regularCorrespondents: 'Léa Müller' },
      { ...base, id: 'r', side: 'brugg', firstName: 'Léa', lastName: 'Müller', regularCorrespondents: '' },
    ]
    expect(getCorrespondentStatus(students[0], students).state).toBe('found')
    expect(getCorrespondentStatus({ ...students[0], regularCorrespondents: 'Personne absente' }, students).state).toBe('missing')
  })

  it('recognizes the four school tracks and the single-name format', () => {
    expect(normalizeSchool('Bercher', '11VP2', 'bercher')).toBe('VP')
    expect(normalizeSchool('Bercher', '11VG1', 'bercher')).toBe('VG')
    expect(normalizeSchool('', 'B2', 'brugg')).toBe('Bezirksschule')
    expect(normalizeSchool('', 'S2', 'brugg')).toBe('Sekundarschule')
    expect(fullName({ name: 'Léa Müller', firstName: 'Ancien', lastName: 'Format' })).toBe('Léa Müller')
  })

  it('does not count host-only pupils as pupils to place', () => {
    const students = [
      { ...base, id: 'b', side: 'bercher', participation: 'host_only', name: 'Hôte Bercher', gender: 'female' },
      { ...base, id: 'r', side: 'brugg', name: 'Voyageur Brugg', gender: 'male' },
    ]
    expect(scenarioStats({ pairings: [] }, students).unassigned).toBe(1)
    expect(evaluatePairing(['b', 'r'], students).conflicts.join(' ')).toContain('ne participe pas au déplacement')
  })
})
