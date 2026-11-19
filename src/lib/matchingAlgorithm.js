import { createNameResolver, createPairingEvaluator, fullName, getCorrespondentStatus, getTrack, hostCapacity } from './compatibility.js'
import { calculateClassBalances } from './classBalance.js'
import { isMaintainedInScenario } from './scenarioParticipation.js'

const naturalCompare = (left, right) => fullName(left).localeCompare(fullName(right), 'fr-CH', { numeric: true, sensitivity: 'base' })

const eligible = (student, assignedIds, scenario) => isMaintainedInScenario(student, scenario)
  && student.participation !== 'host_only'
  && !assignedIds.has(student.id)

const optionQuality = (option) => {
  const optionalPasses = option.result.conditions.optional.filter((item) => item.state === 'pass').length
  const optionalReviews = option.result.conditions.optional.filter((item) => item.state === 'review').length
  return optionalPasses * 10000 - optionalReviews * 200 + option.result.score
}

const blockingCount = (option) => option.result.conditions.indispensable.filter((item) => item.state !== 'pass').length

const evaluateRotations = (members, evaluate) => ['A', 'B']
  .map((rotation) => ({
    rotation,
    result: evaluate(members.map((student) => student.id), rotation),
  }))
  .sort((first, second) => blockingCount(first) - blockingCount(second) || optionQuality(second) - optionQuality(first))

const hasSufficientHosting = (result) => Object.values(result.hosting).every((side) => side.sufficient)
const satisfiesRequirements = (result) => result.conditions.indispensable.every((item) => item.state === 'pass')
const selectable = (result) => satisfiesRequirements(result) && hasSufficientHosting(result)

function buildCandidate(members, evaluate) {
  const assessed = evaluateRotations(members, evaluate)
  const options = assessed.filter(({ result }) => selectable(result))
  return { members, options, assessed }
}

const addEdge = (graph, from, to, capacity, cost) => {
  const forward = { to, reverse: graph[to].length, capacity, cost }
  const backward = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost }
  graph[from].push(forward)
  graph[to].push(backward)
  return forward
}

function maximumWeightMatching(candidates) {
  if (!candidates.length) return []
  const leftIds = [...new Set(candidates.map((candidate) => candidate.members[0].id))]
  const rightIds = [...new Set(candidates.map((candidate) => candidate.members[1].id))]
  const source = 0
  const leftOffset = 1
  const rightOffset = leftOffset + leftIds.length
  const sink = rightOffset + rightIds.length
  const graph = Array.from({ length: sink + 1 }, () => [])
  const maxPairs = Math.min(leftIds.length, rightIds.length)
  const maxQuality = candidates.reduce((max, candidate) => Math.max(max, Math.abs(optionQuality(candidate.options[0]))), 1)
  // Number of pairs takes precedence, then habitual links, then other preferences.
  const usualWeight = 2 * maxPairs * maxQuality + 1
  const pairWeight = 2 * maxPairs * usualWeight + 2 * maxPairs * maxQuality + 1
  const leftNodes = new Map(leftIds.map((id, index) => [id, leftOffset + index]))
  const rightNodes = new Map(rightIds.map((id, index) => [id, rightOffset + index]))

  leftNodes.forEach((node) => addEdge(graph, source, node, 1, 0))
  rightNodes.forEach((node) => addEdge(graph, node, sink, 1, 0))

  const candidateEdges = candidates.map((candidate) => ({
    candidate,
    edge: addEdge(
      graph,
      leftNodes.get(candidate.members[0].id),
      rightNodes.get(candidate.members[1].id),
      1,
      -(pairWeight + candidate.options[0].result.regularLinks * usualWeight + optionQuality(candidate.options[0])),
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
  memberIds: candidate.members.map((student) => student.id),
  rotation: option.rotation,
  result: option.result,
  bercherHostClass: candidate.members.find((student) => student.side === 'bercher' && hostCapacity(student) > 0)?.className || '',
  bruggHostClass: candidate.members.find((student) => student.side === 'brugg' && hostCapacity(student) > 0)?.className || '',
})

const balanceObjective = (pairings, students, scenario) => {
  const countA = pairings.filter((pairing) => pairing.rotation === 'A').length
  const countB = pairings.filter((pairing) => pairing.rotation === 'B').length
  const { balances } = calculateClassBalances({ ...scenario, pairings }, students)
  const absoluteNets = balances.flatMap((row) => [Math.abs(row.first.net), Math.abs(row.second.net)])
  const highestClassDifference = Math.max(0, ...absoluteNets)
  const totalClassDifference = absoluteNets.reduce((total, value) => total + value, 0)
  return {
    cost: highestClassDifference * 1000000 + totalClassDifference * 1000 + Math.abs(countA - countB) * 100,
    optionalQuality: pairings.reduce((total, pairing) => total + (pairing.result?.conditions.optional.filter((item) => item.state === 'pass').length || 0), 0),
  }
}

const compareObjectives = (left, right) => left.cost - right.cost || right.optionalQuality - left.optionalQuality

function assignBalancedRotations(candidates, students, existingPairings, scenario) {
  const ordered = [...candidates].sort((left, right) => left.options.length - right.options.length || naturalCompare(left.members[0], right.members[0]) || naturalCompare(left.members[1], right.members[1]))
  const selected = []

  for (const candidate of ordered) {
    const options = candidate.options.map((option) => {
      const pairing = toPairing(candidate, option)
      return { candidate, option, pairing, objective: balanceObjective([...existingPairings, ...selected.map((item) => item.pairing), pairing], students, scenario) }
    }).sort((left, right) => compareObjectives(left.objective, right.objective))
    selected.push(options[0])
  }

  let changed = true
  for (let pass = 0; changed && pass < selected.length * 2; pass += 1) {
    changed = false
    for (let index = 0; index < selected.length; index += 1) {
      const current = selected[index]
      if (current.candidate.options.length < 2) continue
      const currentObjective = balanceObjective([...existingPairings, ...selected.map((item) => item.pairing)], students, scenario)
      const alternatives = current.candidate.options
        .filter((option) => option.rotation !== current.option.rotation)
        .map((option) => {
          const pairing = toPairing(current.candidate, option)
          const replacement = selected.map((item, itemIndex) => itemIndex === index ? { candidate: current.candidate, option, pairing } : item)
          return { candidate: current.candidate, option, pairing, objective: balanceObjective([...existingPairings, ...replacement.map((item) => item.pairing)], students, scenario) }
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

export function findOptimalPairings(students, assignedIds = new Set(), existingPairings = [], scenario) {
  const available = students.filter((student) => eligible(student, assignedIds, scenario)).sort(naturalCompare)
  const candidates = pairCandidates(available, createPairingEvaluator(students, scenario)).filter((candidate) => candidate.options.length)
  return assignBalancedRotations(maximumWeightMatching(candidates), students, existingPairings, scenario)
}

function pairCandidates(students, evaluate) {
  const hosts = students.filter((student) => hostCapacity(student) > 0)
  const left = hosts.filter((student) => student.side === 'bercher')
  const right = hosts.filter((student) => student.side === 'brugg')
  return left.flatMap((a) => right.map((b) => buildCandidate([a, b], evaluate)))
}

const overlaps = (memberIds, reserved) => memberIds.some((id) => reserved.has(id))
const studentIdsIn = (pairings) => new Set(pairings.flatMap((pairing) => pairing.memberIds))
const candidateIds = (candidate) => candidate.members.map((student) => student.id)
const groupKey = (memberIds) => JSON.stringify([...memberIds].sort())
const incomplete = (student) => !fullName(student) || !student.school || !student.className?.trim() || !['female', 'male'].includes(student.gender)

function reviewReasons(members, correspondents) {
  const reasons = []
  if (members.length === 3) reasons.push('Trio avec accueil possible dans les deux écoles.')
  if (members.some((student) => hostCapacity(student) === 0)) reasons.push('Un élève voyage sans accueillir dans sa famille.')
  if (members.some(incomplete)) reasons.push('Une fiche est incomplète.')
  if (members.some((student) => correspondents.get(student.id).state === 'ambiguous')) reasons.push('Un nom de correspondant habituel reste à vérifier.')

  const memberIds = new Set(members.map((student) => student.id))
  if (members.some((student) => correspondents.get(student.id).matches.some(({ student: match, method }) => method === 'approximate' && memberIds.has(match.id)))) {
    reasons.push('Un correspondant habituel a été reconnu par rapprochement de noms.')
  }
  if (members.some((student) => {
    const { matches } = correspondents.get(student.id)
    return student.conditionType !== 'different_only' && matches.length && !matches.some(({ student: match }) => memberIds.has(match.id))
  })) reasons.push('Un élève est proposé avec une autre personne que son correspondant habituel.')

  const tracksBySide = Object.fromEntries(['bercher', 'brugg'].map((side) => [side, members.filter((student) => student.side === side).map(getTrack).filter(Boolean)]))
  if (tracksBySide.bercher.some((left) => tracksBySide.brugg.some((right) => left !== right))) reasons.push('Les filières diffèrent.')
  return reasons
}

function blocker(result) {
  const details = result.conditions.indispensable.filter((condition) => condition.state !== 'pass').map((condition) => condition.label)
  for (const [side, housing] of Object.entries(result.hosting)) {
    if (housing.sufficient) continue
    const location = side === 'bercher' ? 'Bercher' : 'Brugg'
    const message = `Accueil à ${location} insuffisant : ${housing.available} place${housing.available === 1 ? '' : 's'} pour ${housing.required} élève${housing.required === 1 ? '' : 's'}.`
    if (!details.some((detail) => detail.startsWith(`Accueil à ${location} insuffisant`))) details.push(message)
  }
  return details.join(' ')
}

function pickFixedPairings(fixedPairings, byId, reserved, scenario, evaluate) {
  const valid = []
  const invalid = []
  for (const pairing of fixedPairings) {
    const { memberIds, rotation } = pairing
    const members = memberIds.map((id) => byId.get(id))
    if (![2, 3].includes(members.length) || new Set(memberIds).size !== memberIds.length || !['A', 'B'].includes(rotation)
      || members.some((student) => !student || !eligible(student, reserved, scenario))) {
      invalid.push({ pairing, reason: 'Le groupe comporte un élève indisponible ou une sélection incorrecte.' })
      continue
    }
    const result = evaluate(memberIds, rotation)
    if (!selectable(result)) {
      invalid.push({ pairing, reason: blocker(result) })
      continue
    }
    // Keep a valid choice and refresh its details against the current roster.
    valid.push(toPairing({ members }, { rotation, result }))
    memberIds.forEach((id) => reserved.add(id))
  }
  return { valid, invalid }
}

function generateTrios(student, pool, evaluate) {
  const sameSideHosts = pool.filter((member) => member.id !== student.id && member.side === student.side && hostCapacity(member) > 0)
  const hostsOfTwo = pool.filter((member) => member.side !== student.side && hostCapacity(member) >= 2)
  return sameSideHosts.flatMap((host) => hostsOfTwo.map((hostOfTwo) => {
    const members = [student, host, hostOfTwo].sort((a, b) => a.side.localeCompare(b.side) || naturalCompare(a, b))
    return buildCandidate(members, evaluate)
  })).filter((candidate) => candidate.options.length)
}

function habitualContacts(students, correspondents) {
  const contacts = new Map(students.map((student) => [student.id, new Set()]))
  for (const student of students) {
    const { matches, candidates } = correspondents.get(student.id)
    for (const other of [...matches.map((match) => match.student), ...candidates]) {
      contacts.get(student.id).add(other.id)
      contacts.get(other.id)?.add(student.id)
    }
  }
  return contacts
}

export function computeProvisionalPlan(students, scenario, { fixedPairings = [], deferredStudentIds = new Set() } = {}) {
  const evaluate = createPairingEvaluator(students, scenario)
  const existing = scenario?.pairings || []
  const existingIds = studentIdsIn(existing)
  const deferred = students.filter((student) => eligible(student, existingIds, scenario) && deferredStudentIds.has(student.id)).sort(naturalCompare)
    .map((student) => ({ studentId: student.id, reason: 'Décision laissée en attente.' }))
  const reserved = new Set([...existingIds, ...deferred.map((item) => item.studentId)])
  const byId = new Map(students.map((student) => [student.id, student]))
  const { valid: fixed, invalid: invalidFixedPairings } = pickFixedPairings(fixedPairings, byId, reserved, scenario, evaluate)
  const pool = students.filter((student) => eligible(student, reserved, scenario)).sort(naturalCompare)
  const resolveName = createNameResolver(students)
  const correspondents = new Map(students.map((student) => [student.id, getCorrespondentStatus(student, students, resolveName)]))
  const habits = habitualContacts(students, correspondents)

  const possible = pairCandidates(pool, evaluate)
  const ordinaryCandidates = possible.filter((candidate) => candidate.options.length && !reviewReasons(candidate.members, correspondents).length)
  const original = maximumWeightMatching(ordinaryCandidates)
  const existingAndFixed = [...existing, ...fixed]
  const ordinaryPairings = assignBalancedRotations(original, students, existingAndFixed, scenario)
  const placedIds = studentIdsIn([...fixed, ...ordinaryPairings])
  const poolIds = new Set(pool.map((student) => student.id))
  const countEligible = pool.length + studentIdsIn(fixed).size
  const fixedFullExchange = fixed.filter((pairing) => pairing.memberIds.length === 2).length * 2
  const remainingMatches = new Map()

  function withOption(candidate) {
    const memberIds = candidateIds(candidate)
    const occupyingHosts = new Set(candidate.members.filter((student) => hostCapacity(student) > 0).map((student) => student.id))
    const key = groupKey(occupyingHosts)
    if (!remainingMatches.has(key)) {
      remainingMatches.set(key, maximumWeightMatching(ordinaryCandidates.filter((item) => !overlaps(candidateIds(item), occupyingHosts))))
    }
    const next = remainingMatches.get(key)
    const remainingKeys = new Set(next.map((item) => groupKey(candidateIds(item))))
    const replaces = ordinaryPairings.filter((pairing) => !remainingKeys.has(groupKey(pairing.memberIds)))
    const available = [...existingAndFixed, ...ordinaryPairings.filter((pairing) => !overlaps(pairing.memberIds, occupyingHosts))]
    const [pairing] = assignBalancedRotations([candidate], students, available, scenario)
    const nextPlaced = new Set([...studentIdsIn(fixed), ...memberIds, ...next.flatMap(candidateIds)])
    return {
      kind: memberIds.length === 3 ? 'trio' : 'ordinary',
      pairing,
      selectable: true,
      reason: reviewReasons(candidate.members, correspondents).join(' ') || 'Autre binôme complet.',
      replaces,
      impact: {
        placed: nextPlaced.size,
        fullExchange: fixedFullExchange + next.length * 2 + (memberIds.length === 2 ? 2 : 0),
        unplaced: countEligible - nextPlaced.size,
        addedStudentIds: [...nextPlaced].filter((id) => !placedIds.has(id)),
        displacedStudentIds: [...placedIds].filter((id) => !nextPlaced.has(id)),
      },
    }
  }

  const reviewItems = []
  const blockedById = new Map()
  const covered = new Set()
  const displayed = new Set()
  const awaiting = pool.filter((student) => !placedIds.has(student.id))
    .sort((a, b) => Number(hostCapacity(a) > 0) - Number(hostCapacity(b) > 0) || naturalCompare(a, b))

  for (const student of awaiting) {
    const contacts = habits.get(student.id)
    const blocked = [...contacts].flatMap((id) => {
      const other = byId.get(id)
      if (!other || other.side === student.side) return []
      const members = student.side === 'bercher' ? [student, other] : [other, student]
      const { options, assessed } = buildCandidate(members, evaluate)
      const unavailable = !poolIds.has(id)
      if (!unavailable && options.length) return []
      const best = assessed[0]
      const reason = [unavailable && `${fullName(other)} est indisponible dans ce calcul.`, blocker(best.result)].filter(Boolean).join(' ')
      return [{ kind: 'blocked', pairing: toPairing({ members }, best), selectable: false, reason, impact: null, replaces: [] }]
    })
    const pairs = possible.filter((candidate) => candidate.options.length && (candidate.members.includes(student)
      || (hostCapacity(student) === 0 && candidate.members.some((member) => contacts.has(member.id)))))
    const alternateGroups = [...bestReviewCandidates(pairs, ordinaryPairings), ...bestReviewCandidates(generateTrios(student, pool, evaluate), ordinaryPairings)]
    const viable = alternateGroups.map((candidate) => {
      const option = withOption(candidate)
      if (!option.pairing.memberIds.includes(student.id)) {
        return { ...option, reason: `Binôme complet pour son correspondant. ${fullName(student)} reste à placer. ${option.reason}` }
      }
      return option
    }).sort((a, b) => b.impact.placed - a.impact.placed || b.impact.fullExchange - a.impact.fullExchange
      || b.pairing.result.regularLinks - a.pairing.result.regularLinks || b.pairing.result.score - a.pairing.result.score)
    viable.forEach((option) => option.pairing.memberIds.forEach((id) => covered.add(id)))

    if (!viable.length) {
      blockedById.set(student.id, blocked)
      continue
    }

    const keys = [...viable, ...blocked].map((option) => groupKey(option.pairing.memberIds))
    if (keys.every((key) => displayed.has(key))) continue
    keys.forEach((key) => displayed.add(key))
    const reason = hostCapacity(student) === 0
      ? 'Cet élève souhaite voyager et ne peut pas accueillir.'
      : 'Les propositions disponibles nécessitent une décision.'
    reviewItems.push({ studentId: student.id, reason, options: [...viable, ...blocked] })
  }

  const reviewed = new Set(reviewItems.map((item) => item.studentId))
  const unplaced = awaiting.filter((student) => !reviewed.has(student.id) && !covered.has(student.id)).map((student) => {
    const options = blockedById.get(student.id) || []
    const reason = options[0]?.reason || (hostCapacity(student) ? 'Aucun groupe disponible ne respecte toutes les conditions indispensables.' : 'Aucun groupe disponible ne peut assurer l’accueil dans les deux écoles.')
    return { studentId: student.id, reason, options }
  })

  return {
    ordinaryPairings,
    fixedPairings: fixed,
    invalidFixedPairings,
    reviewItems,
    unplaced,
    deferred,
    summary: {
      placed: placedIds.size,
      fullExchange: ordinaryPairings.length * 2 + fixedFullExchange,
      unplaced: countEligible - placedIds.size,
      deferred: deferred.length,
      noSolution: unplaced.length,
      ordinary: ordinaryPairings.length,
      review: reviewItems.length,
      fixed: fixed.length,
    },
  }
}

function bestReviewCandidates(candidates, ordinaryPairings) {
  const changes = (candidate) => {
    const reserved = new Set(candidateIds(candidate))
    return ordinaryPairings.filter((pairing) => overlaps(pairing.memberIds, reserved)).length
  }
  // A few distinct options per group type are enough for the decision screen.
  return candidates.map((candidate) => ({ candidate, changes: changes(candidate) }))
    .sort((a, b) => a.changes - b.changes || b.candidate.options[0].result.regularLinks - a.candidate.options[0].result.regularLinks
      || optionQuality(b.candidate.options[0]) - optionQuality(a.candidate.options[0]))
    .slice(0, 6).map(({ candidate }) => candidate)
}
