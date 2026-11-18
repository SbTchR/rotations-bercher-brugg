import { describe, expect, it } from 'vitest'
import { normalizeWorkspace } from '../data/demoData.js'
import { getScenarioDecision, updateScenarioDecision } from './scenarioParticipation.js'

const iris = { id: 'iris', side: 'bercher', className: '11VP1', name: 'Iris Martin', active: false }
const lea = { id: 'lea', side: 'bercher', className: '11VG1', name: 'Léa Blanc' }
const nora = { id: 'nora', side: 'brugg', className: 'B3a', name: 'Nora Keller' }

describe('décisions propres aux scénarios', () => {
  it('reprend le refus historique dans les anciens scénarios et préserve le reste de la sauvegarde', () => {
    const input = {
      meta: { id: 14, title: 'Échange', extra: 'Valeur conservée' },
      students: [{ ...iris, address: 'Adresse fictive', extra: 'Autre donnée' }, nora],
      scenarios: [
        { id: 'old', notes: 'Note existante', pairings: [] },
        { id: 'new', exchangeDecisions: { iris: 'maintained' }, pairings: [] },
        { id: 'empty', exchangeDecisions: {}, pairings: [] },
      ],
      activeScenarioId: 'new',
    }
    const result = normalizeWorkspace(input)
    expect(result.meta).toMatchObject(input.meta)
    expect(result.students[0]).toMatchObject(input.students[0])
    expect(result.scenarios[0]).toMatchObject(input.scenarios[0])
    expect(result.scenarios.map((scenario) => getScenarioDecision(iris, scenario))).toEqual(['declined', 'maintained', 'pending'])
    expect(result.activeScenarioId).toBe('new')
    expect(normalizeWorkspace(JSON.parse(JSON.stringify(result)))).toEqual(result)
  })

  it('retire seulement l’élève refusé du groupe du scénario choisi et remet le groupe à vérifier', () => {
    const pairing = { id: 'three', memberIds: ['iris', 'lea', 'nora'], rotation: 'A', locked: true, notes: 'Note', bercherHostClass: '11VP1' }
    const first = { id: 'first', exchangeDecisions: {}, pairings: [pairing] }
    const second = { id: 'second', exchangeDecisions: { iris: 'maintained' }, pairings: [pairing] }
    const byId = new Map([iris, lea, nora].map((student) => [student.id, student]))
    const changed = updateScenarioDecision(first, iris.id, 'declined', byId)
    expect(getScenarioDecision(iris, changed)).toBe('declined')
    expect(changed.pairings).toEqual([{ ...pairing, memberIds: ['lea', 'nora'], bercherHostClass: '', locked: false }])
    expect(getScenarioDecision(iris, second)).toBe('maintained')
    expect(second.pairings[0]).toEqual(pairing)
    expect(getScenarioDecision(iris, updateScenarioDecision(changed, iris.id, 'pending', byId))).toBe('pending')
  })
})
