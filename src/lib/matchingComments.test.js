import { describe, expect, it } from 'vitest'
import { normalizeWorkspace } from '../data/demoData.js'
import { appendMatchingComment, createMatchingComment, getMatchingComments, removeStudentComment } from './matchingComments.js'

const pupil = { id: 'b', side: 'bercher', name: 'Élève fictif', otherInfo: 'Information de la fiche' }
const firstGroup = { id: 'g', memberIds: ['b', 'r'], notes: 'Note de travail', rotation: 'A' }
const first = { id: 's1', pairings: [firstGroup] }
const second = { id: 's2', pairings: [{ ...firstGroup }] }
const workspace = { students: [pupil], scenarios: [first, second], activeScenarioId: first.id }

describe('messages des appairages', () => {
  it('conserve les anciens messages et les nouveaux sans type dans la sauvegarde JSON', () => {
    const question = { ...createMatchingComment('  Horaire à confirmer ?  ', 'Responsable 1'), kind: 'question' }
    const comment = createMatchingComment('Horaire confirmé.', 'Responsable 2')
    const questionAdded = appendMatchingComment(workspace, { studentId: pupil.id }, question)
    const next = appendMatchingComment(questionAdded, { studentId: pupil.id }, comment)

    expect(question).toMatchObject({ kind: 'question', text: 'Horaire à confirmer ?', author: 'Responsable 1' })
    expect(comment).not.toHaveProperty('kind')
    expect(getMatchingComments(next.students[0])).toEqual([question, comment])
    expect(next.students[0].otherInfo).toBe(pupil.otherInfo)
    expect(next.scenarios).toBe(workspace.scenarios)
    expect(getMatchingComments(normalizeWorkspace(JSON.parse(JSON.stringify(next))).students[0])).toEqual([question, comment])
    expect(getMatchingComments(pupil)).toEqual([])
  })

  it('attache un message au groupe et au scénario choisis, sans modifier la note de travail', () => {
    const comment = createMatchingComment('À revoir ensemble.', 'Responsable 2')
    const next = appendMatchingComment(workspace, { scenarioId: first.id, pairingId: firstGroup.id }, comment)

    expect(next.students).toBe(workspace.students)
    expect(next.scenarios[1]).toBe(second)
    expect(next.scenarios[0].pairings[0]).toMatchObject({ ...firstGroup, matchingComments: [comment] })
    expect(getMatchingComments(normalizeWorkspace(JSON.parse(JSON.stringify(next))).scenarios[0].pairings[0])).toEqual([comment])
    expect(appendMatchingComment(workspace, { scenarioId: first.id, pairingId: 'absent' }, comment)).toBe(workspace)
  })

  it('refuse les messages vides', () => {
    expect(createMatchingComment(' \n ', 'Responsable 1')).toBeNull()
  })

  it('supprime seulement le message ciblé sur la fiche élève', () => {
    const target = { studentId: pupil.id }
    const question = { ...createMatchingComment('Horaire à confirmer ?', 'Responsable 1'), kind: 'question' }
    const reply = createMatchingComment('Horaire confirmé.', 'Responsable 2')
    const withComments = appendMatchingComment(appendMatchingComment(workspace, target, question), target, reply)
    const next = removeStudentComment(withComments, pupil.id, question.id)
    expect(getMatchingComments(next.students[0])).toEqual([reply])
    expect(next.students[0].otherInfo).toBe(pupil.otherInfo)
    expect(next.scenarios).toBe(workspace.scenarios)
    expect(removeStudentComment(next, pupil.id, question.id)).toBe(next)
  })
})
