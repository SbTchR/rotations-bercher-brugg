import { evaluatePairing, fullName } from './compatibility.js'
import { calculateClassBalances } from './classBalance.js'

const naturalCompare = (left, right) => fullName(left).localeCompare(fullName(right), 'fr-CH', { numeric: true, sensitivity: 'base' })

const eligible = (student, assignedIds) => student.active !== false
  && student.participation !== 'host_only'
  && !assignedIds.has(student.id)

const optionQuality = (option) => {
  const optionalPasses = option.result.conditions.optional.filter((item) => item.state === 'pass').length
  const optionalReviews = option.result.conditions.optional.filter((item) => item.state === 'review').length
  return optionalPasses * 10000 - optionalReviews * 200 + option.result.score
}

const validOptions = (left, right, students) => ['A', 'B']
  .map((rotation) => ({
    rotation,
    result: evaluatePairing([left.id, right.id], students, rotation),
  }))
  .filter((option) => option.result.conditions.indispensable.every((item) => item.state === 'pass'))
  .sort((first, second) => optionQuality(second) - optionQuality(first))

const bestOption = (options) => options[0]

const addEdge = (graph, from, to, capacity, cost, data = null) => {
  const forward = { to, reverse: graph[to].length, capacity, cost, data }
  const backward = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost, data: null }
  graph[from].push(forward)
  graph[to].push(backward)
  return forward
}

function maximumWeightMatching(leftStudents, rightStudents, candidates) {
  const source = 0
  const leftOffset = 1
  const rightOffset = leftOffset + leftStudents.length
  const sink = rightOffset + rightStudents.length
  const graph = Array.from({ length: sink + 1 }, () => [])

  leftStudents.forEach((_, index) => addEdge(graph, source, leftOffset + index, 1, 0))
  rightStudents.forEach((_, index) => addEdge(graph, rightOffset + index, sink, 1, 0))

  const candidateEdges = candidates.map((candidate) => ({
    candidate,
    edge: addEdge(
      graph,
      leftOffset + candidate.leftIndex,
      rightOffset + candidate.rightIndex,
      1,
      -(1000000 + candidate.quality),
      candidate,
    ),
  }))

  while (true) {
    const distances = Array(graph.length).fill(Number.POSITIVE_INFINITY)
    const previousNode = Array(graph.length).fill(-1)
    const previousEdge = Array(graph.length).fill(-1)
    const queued = Array(graph.length).fill(false)
    const queue = [source]
    distances[source] = 0
    queued[source] = true

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor]
      queued[node] = false
      graph[node].forEach((edge, edgeIndex) => {
        if (!edge.capacity || distances[edge.to] <= distances[node] + edge.cost) return
        distances[edge.to] = distances[node] + edge.cost
        previousNode[edge.to] = node
        previousEdge[edge.to] = edgeIndex
        if (!queued[edge.to]) {
          queue.push(edge.to)
          queued[edge.to] = true
        }
      })
    }

    if (!Number.isFinite(distances[sink]) || distances[sink] >= 0) break
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]]
      edge.capacity -= 1
      graph[node][edge.reverse].capacity += 1
    }
  }

  return candidateEdges.filter(({ edge }) => edge.capacity === 0).map(({ candidate }) => candidate)
}

const toPairing = (candidate, option) => ({
  memberIds: [candidate.left.id, candidate.right.id],
  rotation: option.rotation,
  result: option.result,
  bercherHostClass: candidate.left.className || '',
  bruggHostClass: candidate.right.className || '',
})

const balanceObjective = (pairings, students) => {
  const countA = pairings.filter((pairing) => pairing.rotation === 'A').length
  const countB = pairings.filter((pairing) => pairing.rotation === 'B').length
  const { balances } = calculateClassBalances({ pairings }, students)
  const absoluteNets = balances.flatMap((row) => [Math.abs(row.first.net), Math.abs(row.second.net)])
  const highestClassDifference = Math.max(0, ...absoluteNets)
  const totalClassDifference = absoluteNets.reduce((total, value) => total + value, 0)
  return {
    cost: highestClassDifference * 1000000 + totalClassDifference * 1000 + Math.abs(countA - countB) * 100,
    optionalQuality: pairings.reduce((total, pairing) => total + (pairing.result?.conditions.optional.filter((item) => item.state === 'pass').length || 0), 0),
  }
}

const compareObjectives = (left, right) => left.cost - right.cost || right.optionalQuality - left.optionalQuality

function assignBalancedRotations(candidates, students, existingPairings) {
  const ordered = [...candidates].sort((left, right) => left.options.length - right.options.length || naturalCompare(left.left, right.left) || naturalCompare(left.right, right.right))
  const selected = []

  for (const candidate of ordered) {
    const options = candidate.options.map((option) => {
      const pairing = toPairing(candidate, option)
      return { candidate, option, pairing, objective: balanceObjective([...existingPairings, ...selected.map((item) => item.pairing), pairing], students) }
    }).sort((left, right) => compareObjectives(left.objective, right.objective))
    selected.push(options[0])
  }

  let changed = true
  for (let pass = 0; changed && pass < selected.length * 2; pass += 1) {
    changed = false
    for (let index = 0; index < selected.length; index += 1) {
      const current = selected[index]
      if (current.candidate.options.length < 2) continue
      const currentObjective = balanceObjective([...existingPairings, ...selected.map((item) => item.pairing)], students)
      const alternatives = current.candidate.options
        .filter((option) => option.rotation !== current.option.rotation)
        .map((option) => {
          const pairing = toPairing(current.candidate, option)
          const replacement = selected.map((item, itemIndex) => itemIndex === index ? { candidate: current.candidate, option, pairing } : item)
          return { candidate: current.candidate, option, pairing, objective: balanceObjective([...existingPairings, ...replacement.map((item) => item.pairing)], students) }
        })
        .sort((left, right) => compareObjectives(left.objective, right.objective))
      if (alternatives[0] && compareObjectives(alternatives[0].objective, currentObjective) < 0) {
        selected[index] = alternatives[0]
        changed = true
      }
    }
  }

  return selected.map(({ pairing }) => pairing)
}

export function findOptimalPairings(students, assignedIds = new Set(), existingPairings = []) {
  const leftStudents = students.filter((student) => student.side === 'bercher' && eligible(student, assignedIds)).sort(naturalCompare)
  const rightStudents = students.filter((student) => student.side === 'brugg' && eligible(student, assignedIds)).sort(naturalCompare)
  const candidates = []

  leftStudents.forEach((left, leftIndex) => {
    rightStudents.forEach((right, rightIndex) => {
      const options = validOptions(left, right, students)
      const option = bestOption(options)
      if (!option) return
      candidates.push({ left, right, leftIndex, rightIndex, options, quality: optionQuality(option) })
    })
  })

  return assignBalancedRotations(maximumWeightMatching(leftStudents, rightStudents, candidates), students, existingPairings)
}
