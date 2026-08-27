/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createDemoWorkspace } from '../data/demoData'
import { fullName } from '../lib/compatibility'
import { cloudEnabled, getSession, loadWorkspace, saveWorkspace, signInWithCredentials, signOut } from '../lib/storage'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessState, setAccessState] = useState('loading')
  const [syncState, setSyncState] = useState('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const versionRef = useRef(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setSyncMessage('')
    try {
      const result = await loadWorkspace()
      if (result.configurationRequired) {
        setAccessState('configuration')
        setWorkspace(null)
        setUser(null)
      } else if (result.requiresAuth) {
        setAccessState('auth')
        setWorkspace(null)
        setUser(null)
      } else if (result.unauthorized) {
        setAccessState('unauthorized')
        setWorkspace(null)
        setUser(result.user)
      } else {
        setAccessState('ready')
        setWorkspace(result.workspace)
        setUser(result.user || (await getSession())?.user)
        versionRef.current = result.version
        setSyncState('saved')
        setPast([])
        setFuture([])
      }
    } catch (error) {
      setAccessState('error')
      setSyncMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!workspace || syncState !== 'dirty') return undefined
    const timer = window.setTimeout(async () => {
      setSyncState('saving')
      try {
        const result = await saveWorkspace(workspace, versionRef.current)
        versionRef.current = result.version
        setSyncState('saved')
        setSyncMessage('')
      } catch (error) {
        setSyncState(error.code === 'VERSION_CONFLICT' ? 'conflict' : 'error')
        setSyncMessage(error.message)
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [workspace, syncState])

  const commit = useCallback((updater, activityText = '') => {
    setWorkspace((current) => {
      if (!current) return current
      const next = typeof updater === 'function' ? updater(current) : updater
      const stamped = activityText
        ? { ...next, activity: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: activityText }, ...(next.activity || [])].slice(0, 100) }
        : next
      setPast((items) => [...items.slice(-39), current])
      setFuture([])
      return stamped
    })
    setSyncState('dirty')
  }, [])

  const undo = useCallback(() => {
    setPast((items) => {
      if (!items.length) return items
      const previous = items[items.length - 1]
      setWorkspace((current) => {
        setFuture((nextItems) => [current, ...nextItems].slice(0, 40))
        return previous
      })
      setSyncState('dirty')
      return items.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((items) => {
      if (!items.length) return items
      const next = items[0]
      setWorkspace((current) => {
        setPast((previousItems) => [...previousItems, current].slice(-40))
        return next
      })
      setSyncState('dirty')
      return items.slice(1)
    })
  }, [])

  const actions = useMemo(() => ({
    replaceWorkspace(next, label = 'Données remplacées') {
      commit(next, label)
    },
    resetDemo() {
      commit(createDemoWorkspace(), 'Données de démonstration restaurées')
    },
    addStudent(student) {
      commit((current) => ({ ...current, students: [...current.students, student] }), `Fiche ajoutée: ${fullName(student)}`.trim())
    },
    updateStudent(student) {
      commit((current) => {
        const students = current.students.map((item) => item.id === student.id ? student : item)
        if (student.active !== false) return { ...current, students }
        const byId = new Map(students.map((item) => [item.id, item]))
        return {
          ...current,
          students,
          scenarios: current.scenarios.map((scenario) => ({
            ...scenario,
            pairings: scenario.pairings.map((pairing) => ({ ...pairing, memberIds: pairing.memberIds.filter((id) => id !== student.id) })).filter((pairing) => {
              const members = pairing.memberIds.map((id) => byId.get(id)).filter(Boolean)
              return members.length >= 2 && members.some((item) => item.side === 'bercher') && members.some((item) => item.side === 'brugg')
            }),
          })),
        }
      }, student.active === false ? `Échange refusé: ${fullName(student)}`.trim() : `Fiche mise à jour: ${fullName(student)}`.trim())
    },
    removeStudents(studentIds) {
      const ids = new Set(studentIds)
      commit((current) => ({
        ...current,
        students: current.students.filter((student) => !ids.has(student.id)),
        scenarios: current.scenarios.map((scenario) => ({
          ...scenario,
          pairings: scenario.pairings
            .map((pairing) => ({ ...pairing, memberIds: pairing.memberIds.filter((id) => !ids.has(id)) }))
            .filter((pairing) => {
              const members = pairing.memberIds.map((id) => current.students.find((student) => student.id === id && !ids.has(id))).filter(Boolean)
              return members.length >= 2 && members.some((student) => student.side === 'bercher') && members.some((student) => student.side === 'brugg')
            }),
        })),
      }), `${ids.size} fiche${ids.size > 1 ? 's supprimées' : ' supprimée'}`)
    },
    setActiveScenario(id) {
      commit((current) => ({ ...current, activeScenarioId: id }))
    },
    addScenario(name, createdBy = '') {
      const id = crypto.randomUUID()
      const stamp = new Date().toISOString()
      commit((current) => ({
        ...current,
        activeScenarioId: id,
        scenarios: [...current.scenarios, { id, name, createdBy, status: 'draft', createdAt: stamp, updatedAt: stamp, pairings: [] }],
      }), `Scénario créé: ${name}`)
    },
    cloneScenario(sourceId, name, createdBy = '') {
      const id = crypto.randomUUID()
      const stamp = new Date().toISOString()
      commit((current) => {
        const source = current.scenarios.find((scenario) => scenario.id === sourceId)
        return {
          ...current,
          activeScenarioId: id,
          scenarios: [...current.scenarios, {
            ...source,
            id,
            name,
            createdBy,
            status: 'draft',
            createdAt: stamp,
            updatedAt: stamp,
            pairings: (source?.pairings || []).map((pairing) => ({ ...pairing, id: crypto.randomUUID(), locked: false })),
          }],
        }
      }, `Scénario dupliqué: ${name}`)
    },
    removeScenario(scenarioId) {
      commit((current) => {
        if (current.scenarios.length <= 1) return current
        const scenarios = current.scenarios.filter((scenario) => scenario.id !== scenarioId)
        return {
          ...current,
          scenarios,
          activeScenarioId: current.activeScenarioId === scenarioId ? scenarios[0].id : current.activeScenarioId,
        }
      }, 'Scénario supprimé')
    },
    updateScenario(scenarioId, updates) {
      commit((current) => ({
        ...current,
        scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId ? { ...scenario, ...updates, updatedAt: new Date().toISOString() } : scenario),
      }), updates.status === 'validated' ? 'Scénario validé' : 'Scénario mis à jour')
    },
    addPairing(scenarioId, memberIds, rotation = '', hostClasses = {}) {
      const pairing = { id: crypto.randomUUID(), memberIds, rotation, locked: false, notes: '', ...hostClasses }
      commit((current) => ({
        ...current,
        scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId
          ? { ...scenario, pairings: [...scenario.pairings, pairing], updatedAt: new Date().toISOString() }
          : scenario),
      }), 'Nouveau groupe d’appairage')
      return pairing.id
    },
    addPairings(scenarioId, suggestions) {
      const pairings = suggestions.map((suggestion) => ({
        id: crypto.randomUUID(),
        memberIds: suggestion.memberIds,
        rotation: suggestion.rotation,
        locked: false,
        notes: 'Proposé automatiquement — à contrôler.',
        bercherHostClass: suggestion.bercherHostClass || '',
        bruggHostClass: suggestion.bruggHostClass || '',
      }))
      commit((current) => ({
        ...current,
        scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId
          ? { ...scenario, pairings: [...scenario.pairings, ...pairings], updatedAt: new Date().toISOString() }
          : scenario),
      }), `${pairings.length} binôme${pairings.length > 1 ? 's proposés' : ' proposé'} automatiquement`)
      return pairings.map((pairing) => pairing.id)
    },
    updatePairing(scenarioId, pairingId, updates) {
      commit((current) => ({
        ...current,
        scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId ? {
          ...scenario,
          updatedAt: new Date().toISOString(),
          pairings: scenario.pairings.map((pairing) => pairing.id === pairingId ? { ...pairing, ...updates } : pairing),
        } : scenario),
      }))
    },
    removePairing(scenarioId, pairingId) {
      commit((current) => ({
        ...current,
        scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId
          ? { ...scenario, pairings: scenario.pairings.filter((pairing) => pairing.id !== pairingId), updatedAt: new Date().toISOString() }
          : scenario),
      }), 'Groupe retiré')
    },
    updateMeta(updates) {
      commit((current) => ({ ...current, meta: { ...current.meta, ...updates } }), 'Paramètres mis à jour')
    },
  }), [commit])

  const value = {
    workspace,
    user,
    loading,
    accessState,
    syncState,
    syncMessage,
    cloudEnabled,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    actions,
    undo,
    redo,
    reload,
    signInWithCredentials: async (accountId, password) => {
      await signInWithCredentials(accountId, password)
      await reload()
    },
    signOut: async () => { await signOut(); await reload() },
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('WorkspaceProvider manquant')
  return value
}
