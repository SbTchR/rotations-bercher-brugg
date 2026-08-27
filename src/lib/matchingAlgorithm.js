import { evaluatePairing, fullName } from './compatibility.js'

const naturalCompare = (left, right) => fullName(left).localeCompare(fullName(right), 'fr-CH', { numeric: true, sensitivity: 'base' })

const eligible = (student, assignedIds) => student.active !== false
  && student.participation !== 'host_only'
  && !assignedIds.has(student.id)

const optionQuality = (option) => {
  const optionalPasses = option.result.conditions.optional.filter((item) => item.state === 'pass').length
  const optionalReviews = option.result.conditions.optional.filter((item) => item.state === 'review').length
  return optionalPasses * 10000 - optionalReviews * 200 + option.result.score
}

const bestOption = (left, right, students) => ['A', 'B']
  .map((rotation) => ({
    rotation,
    result: evaluatePairing([left.id, right.id], students, rotation),
  }))
  .filter((option) => option.result.conditions.indispensable.every((item) => item.state === 'pass'))
  .sort((first, second) => optionQuality(second) - optionQuality(first))[0]

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

export function findOptimalPairings(students, assignedIds = new Set()) {
  const leftStudents = students.filter((student) => student.side === 'bercher' && eligible(student, assignedIds)).sort(naturalCompare)
  const rightStudents = students.filter((student) => student.side === 'brugg' && eligible(student, assignedIds)).sort(naturalCompare)
  const candidates = []

  leftStudents.forEach((left, leftIndex) => {
    rightStudents.forEach((right, rightIndex) => {
      const option = bestOption(left, right, students)
      if (!option) return
      candidates.push({ left, right, leftIndex, rightIndex, ...option, quality: optionQuality(option) })
    })
  })

  return maximumWeightMatching(leftStudents, rightStudents, candidates).map(({ left, right, rotation, result }) => ({
    memberIds: [left.id, right.id],
    rotation,
    result,
    bercherHostClass: left.className || '',
    bruggHostClass: right.className || '',
  }))
}
