import { isMaintainedInScenario } from './scenarioParticipation.js'

export const fullName = (student) => student?.name?.trim() || [student?.firstName, student?.lastName].filter(Boolean).join(' ').trim()

export const isStudentEnrollmentComplete = (student) => Boolean(
  fullName(student)
  && student?.school
  && student?.className?.trim()
  && ['female', 'male'].includes(student?.gender)
  && student?.regularCorrespondents?.trim(),
)

export const schoolLabels = {
  VP: 'VP · Bercher',
  VG: 'VG · Bercher',
  Bezirksschule: 'Bez · Brugg',
  Sekundarschule: 'Sek · Brugg',
  Bercher: 'Bercher',
}

export const schoolLabel = (school) => schoolLabels[school] || school || 'Établissement non renseigné'

export function normalizeSchool(school, className = '', side = '') {
  const value = String(school || '').trim()
  if (side === 'bercher' || value === 'Bercher' || value === 'VP' || value === 'VG') {
    if (value === 'VP' || /VP/i.test(className)) return 'VP'
    if (value === 'VG' || /VG/i.test(className)) return 'VG'
    return 'Bercher'
  }
  if (value === 'Bez' || value === 'Bezirksschule' || /^B/i.test(className)) return 'Bezirksschule'
  if (value === 'Sek' || value === 'Sekundarschule' || /^S/i.test(className)) return 'Sekundarschule'
  return value
}

const normalizeName = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/ß/g, 'ss')
  .replace(/œ/g, 'oe')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const nameWords = (name) => name ? name.split(' ') : []
const familyNameLast = (words) => [...words.slice(1), words[0]]

function wordDistance(left, right, allowTypos) {
  if (left === right) return 0
  if (!allowTypos || !/^\p{L}{3,}$/u.test(left) || !/^\p{L}{3,}$/u.test(right)) return Infinity
  if (Math.max(left.length, right.length) < 4 || Math.abs(left.length - right.length) > 1) return Infinity

  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left]
  let firstDifference = 0
  while (firstDifference < shorter.length && shorter[firstDifference] === longer[firstDifference]) firstDifference += 1
  if (shorter.length < longer.length) return shorter.slice(firstDifference) === longer.slice(firstDifference + 1) ? 1 : Infinity
  if (shorter.slice(firstDifference + 1) === longer.slice(firstDifference + 1)) return 1
  const transposed = shorter[firstDifference] === longer[firstDifference + 1] && shorter[firstDifference + 1] === longer[firstDifference]
  return transposed && shorter.slice(firstDifference + 2) === longer.slice(firstDifference + 2) ? 1 : Infinity
}

function alignedDistance(left, right, allowTypos) {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left]
  const omitted = longer.length - shorter.length
  if (shorter.length < 2 || omitted > 3) return Infinity

  // Keep both ends of the name and allow extra middle names between them.
  const ends = wordDistance(shorter[0], longer[0], allowTypos) + wordDistance(shorter.at(-1), longer.at(-1), allowTypos)
  if (ends > 1) return Infinity
  const middle = longer.slice(1, -1)
  let distances = Array(middle.length + 1).fill(ends)
  for (const word of shorter.slice(1, -1)) {
    const next = [Infinity]
    middle.forEach((candidate, index) => {
      next.push(Math.min(next[index], distances[index] + wordDistance(word, candidate, allowTypos)))
    })
    distances = next
  }
  const edits = distances.at(-1)
  return edits <= 1 ? edits * 8 + omitted * 2 : Infinity
}

function approximateDistance(wanted, candidate, allowTypos) {
  return Math.min(
    alignedDistance(wanted, candidate, allowTypos),
    alignedDistance(familyNameLast(wanted), candidate, allowTypos) + 1,
    alignedDistance(wanted, familyNameLast(candidate), allowTypos) + 1,
  )
}

function nameDistance(wanted, words, entry, allowTypos, allowSingleToken) {
  if (entry.name === wanted) return 0
  if (allowSingleToken && words.length === 1 && wanted.length >= 3 && entry.words.includes(wanted)) return 32
  return 1 + approximateDistance(words, entry.words, allowTypos)
}

export function createNameResolver(students) {
  const roster = students.map((student) => {
    const name = normalizeName(fullName(student))
    return { student, name, words: nameWords(name) }
  })
  const cache = new Map()

  return (value, side, { allowTypos = true, allowSingleToken = false } = {}) => {
    const name = String(value ?? '').trim()
    const wanted = normalizeName(name)
    if (!wanted) return { state: 'empty', name, student: null, method: null, candidates: [] }
    const key = `${side}|${allowTypos}|${allowSingleToken}|${wanted}`
    if (!cache.has(key)) {
      const words = nameWords(wanted)
      let best = Infinity
      let candidates = []
      for (const entry of roster) {
        if (!entry.name || (side && entry.student.side !== side)) continue
        const distance = nameDistance(wanted, words, entry, allowTypos, allowSingleToken)
        if (!Number.isFinite(distance) || distance > best) continue
        if (distance < best) candidates = []
        best = distance
        candidates.push(entry.student)
      }
      const student = candidates.length === 1 ? candidates[0] : null
      cache.set(key, {
        state: student ? 'found' : candidates.length ? 'ambiguous' : 'missing',
        student,
        method: student ? (best === 0 ? 'exact' : 'approximate') : null,
        candidates,
      })
    }
    return { name, ...cache.get(key) }
  }
}

const oppositeSide = (student) => student.side === 'bercher' ? 'brugg' : 'bercher'
const namedPartnerOptions = { allowTypos: false, allowSingleToken: true }
const regularCorrespondentOptions = { allowSingleToken: true }

export function findStudentByName(value, students, side = '', resolveName = createNameResolver(students)) {
  return resolveName(value, side, namedPartnerOptions).student
}

function resolveCorrespondents(student, resolveName) {
  const name = String(student?.regularCorrespondents ?? '').trim()
  const side = student && oppositeSide(student)
  const entries = name.split(/[,;/\r\n]+|\s+(?:ou|oder)\s+/i).map((part) => part.trim()).filter(Boolean)
  let resolutions = entries.map((entry) => resolveName(entry, side, regularCorrespondentOptions))

  // Keep legacy “Surname, Given name” unless a separately identified pupil would be lost.
  if (entries.length === 2 && /^[^,;/\r\n]+,[^,;/\r\n]+$/.test(name) && entries.some((entry) => !entry.includes(' '))) {
    const surnameFirst = resolveName(name, side, regularCorrespondentOptions)
    const preservesSeparateMatches = surnameFirst.candidates.every((candidate) => (
      resolutions.every((entry) => !entry.student || entry.student.id === candidate.id)
    ))
    if (surnameFirst.candidates.length && preservesSeparateMatches) resolutions = [surnameFirst]
  }

  const matchesById = new Map()
  const ambiguousById = new Map()
  for (const resolution of resolutions) {
    if (resolution.state === 'found') {
      const { student, method } = resolution
      if (!matchesById.has(student.id) || method === 'exact') matchesById.set(student.id, { student, method })
    }
    if (resolution.state === 'ambiguous') {
      resolution.candidates.forEach((candidate) => ambiguousById.set(candidate.id, candidate))
    }
  }
  const matches = [...matchesById.values()]
  const candidates = [...ambiguousById.values()]
  const missingNames = resolutions.filter((entry) => entry.state === 'missing').map((entry) => entry.name)
  const first = matches[0]
  const state = first ? 'found' : candidates.length ? 'ambiguous' : normalizeName(name) ? 'missing' : 'empty'
  return { state, name, student: first?.student ?? null, method: first?.method ?? null, candidates, matches, missingNames }
}

export function getCorrespondentStatus(student, students, resolveName = createNameResolver(students)) {
  return resolveCorrespondents(student, resolveName)
}

export function getTrack(student) {
  if (!student) return ''
  if (student.side === 'bercher') {
    if (student.school === 'VP' || /VP/i.test(student.className || '')) return 'bezirk'
    if (student.school === 'VG' || /VG/i.test(student.className || '')) return 'sekundar'
  }
  if (student.school === 'Bezirksschule' || /^\s*B/i.test(student.className || '')) return 'bezirk'
  if (student.school === 'Sekundarschule' || /^\s*S/i.test(student.className || '')) return 'sekundar'
  return ''
}

export function getTrackLabel(student) {
  const track = getTrack(student)
  if (track === 'bezirk') return student.side === 'bercher' ? 'VP · préférence Bez' : 'Bez · préférence VP'
  if (track === 'sekundar') return student.side === 'bercher' ? 'VG · préférence Sek' : 'Sek · préférence VG'
  return 'Filière non reconnue'
}

export const cannotHost = (student) => student?.participation === 'travel_no_host' || student?.canHost === false

export function hostCapacity(student) {
  if (!student || cannotHost(student)) return 0
  const capacity = Number(student.hostCapacity)
  return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : 1
}

function hostingAvailability(hosts, visitors, scenario) {
  const required = visitors.filter((student) => student.participation !== 'host_only' && isMaintainedInScenario(student, scenario)).length
  const available = hosts.reduce((sum, student) => sum + (isMaintainedInScenario(student, scenario) ? hostCapacity(student) : 0), 0)
  return { required, available, sufficient: available >= required }
}

const uniqueConditions = (items) => items.filter((item, index, array) => array.findIndex((candidate) => candidate.label === item.label) === index)

function assessGender(student, partners) {
  if (student.acceptsOtherGender) return { state: null }
  const known = ['female', 'male'].includes(student.gender)
  const incompatible = known && partners.find((partner) => partner.gender && partner.gender !== 'unspecified' && partner.gender !== student.gender)
  if (incompatible) return { state: 'fail', incompatible }
  if (!known || partners.some((partner) => !['female', 'male'].includes(partner.gender))) return { state: 'review' }
  return { state: partners.length ? 'pass' : null }
}

function evaluate(memberIds, rotation, byId, getRelations, scenario) {
  const members = memberIds.map((id) => byId.get(id)).filter(Boolean)
  const bercher = members.filter((student) => student.side === 'bercher')
  const brugg = members.filter((student) => student.side === 'brugg')
  const indispensable = []
  const optional = []
  const memberConditions = Object.fromEntries(members.map((student) => [student.id, {}]))
  const addEssential = (state, label) => indispensable.push({ state, label })
  const addOptional = (state, label) => optional.push({ state, label })

  if (members.length !== memberIds.length) addEssential('fail', 'Une fiche élève du groupe est introuvable.')
  if (new Set(memberIds).size !== memberIds.length) addEssential('fail', 'Un élève figure plusieurs fois dans ce groupe.')
  if (!bercher.length || !brugg.length) addEssential('fail', 'Le groupe doit contenir des élèves des deux écoles.')

  const hosting = {
    bercher: hostingAvailability(bercher, brugg, scenario),
    brugg: hostingAvailability(brugg, bercher, scenario),
  }
  if (bercher.length && brugg.length) {
    for (const [side, { required, available, sufficient }] of Object.entries(hosting)) {
      if (sufficient) continue
      const location = side === 'bercher' ? 'Bercher' : 'Brugg'
      const capacityMessage = `Accueil à ${location} insuffisant : ${available} place${available > 1 ? 's' : ''} pour ${required} élève${required > 1 ? 's' : ''}.`
      if (members.length > 2) addEssential('fail', capacityMessage)
      else addOptional('review', capacityMessage)
    }
  }

  for (const student of members) {
    if (student.participation === 'host_only') addEssential('fail', `${fullName(student)} ne participe pas au déplacement.`)
    if (!isMaintainedInScenario(student, scenario)) addEssential('fail', `${fullName(student)} a été retiré de l’échange dans ce scénario.`)
    if (student.status === 'review') addOptional('review', `Fiche de ${fullName(student)} à vérifier.`)
  }

  const genderAssessments = members.map((student) => {
    const partners = student.side === 'bercher' ? brugg : bercher
    const assessment = assessGender(student, partners)
    memberConditions[student.id].gender = assessment.state
    return { student, ...assessment }
  })
  if (members.length === 2 && members[0].gender === members[1].gender && ['female', 'male'].includes(members[0].gender)) {
    addEssential('pass', `Les deux élèves sont des ${members[0].gender === 'female' ? 'filles' : 'garçons'}.`)
  } else {
    const genderFailures = genderAssessments.flatMap(({ student, incompatible }) => {
      return incompatible ? [`${fullName(student)} ne peut pas être avec ${incompatible.gender === 'male' ? 'un garçon' : 'une fille'}.`] : []
    })
    if (genderFailures.length) genderFailures.forEach((label) => addEssential('fail', label))
    else if (genderAssessments.some(({ student, state }) => student.acceptsOtherGender === false && state === 'review')) {
      addEssential('review', 'Le genre doit être renseigné pour vérifier la condition de partenaire du même sexe.')
    } else addEssential('pass', members.every((student) => student.acceptsOtherGender) ? 'Les élèves acceptent un partenaire de l’autre sexe.' : 'La condition de genre est respectée.')
  }

  const requiredGroups = members.filter((student) => student.requiredRotation)
  if (!requiredGroups.length) addEssential('pass', 'Pas de condition de groupe spécifiée.')
  else {
    for (const student of requiredGroups) {
      memberConditions[student.id].rotation = !rotation ? 'review' : rotation === student.requiredRotation ? 'pass' : 'fail'
      if (!rotation) addEssential('review', `${fullName(student)} ne peut participer que dans le groupe ${student.requiredRotation}.`)
      else if (rotation !== student.requiredRotation) addEssential('fail', `${fullName(student)} ne peut pas être dans le groupe ${rotation}.`)
      else addOptional('pass', `${fullName(student)} est dans le groupe demandé (${rotation}).`)
    }
  }

  const regularLinksById = new Map()
  let hasAmbiguousUsualLink = false
  let hasDifferentUsualPartner = false
  for (const student of members) {
    const { regular, named } = getRelations(student)
    const requestedMatches = regular.matches.filter((match) => memberIds.includes(match.student.id))
    const requestedRegular = requestedMatches[0]
    const matchedNames = requestedMatches.map(({ student: match }) => fullName(match)).join(', ')
    const requestedNamed = memberIds.includes(named.student?.id)
    const hasAmbiguousRegularInGroup = regular.candidates.some((candidate) => memberIds.includes(candidate.id))
    const ambiguousRegular = `Plusieurs élèves correspondent au nom indiqué par ${fullName(student)}.`
    const addPartnerCondition = (state, label) => {
      memberConditions[student.id].partner = state === 'pass' && student.conditionType === 'regular_only'
        && !requestedMatches.some(({ method }) => method === 'exact') ? 'review' : state
      addEssential(state, label)
    }

    if (requestedRegular) {
      regularLinksById.set(student.id, requestedMatches.map(({ student: match }) => match.id))
      for (const match of requestedMatches) {
        if (match.method === 'approximate') addOptional('review', `Correspondant de ${fullName(student)} reconnu par rapprochement (${fullName(match.student)}).`)
      }
    } else if (hasAmbiguousRegularInGroup) {
      hasAmbiguousUsualLink = true
    } else if (regular.matches.length) {
      hasDifferentUsualPartner = true
    }

    if (student.conditionType === 'regular_only') {
      if (regular.state === 'empty') addPartnerCondition('review', `Le correspondant habituel exigé par ${fullName(student)} n’est pas renseigné.`)
      else if (requestedRegular) addPartnerCondition('pass', `${fullName(student)} retrouve ${matchedNames} parmi ses correspondants habituels, comme demandé.`)
      else if (regular.state === 'ambiguous' || hasAmbiguousRegularInGroup) addPartnerCondition('review', ambiguousRegular)
      else addPartnerCondition('fail', `Aucun des correspondants habituels exigés par ${fullName(student)} ne figure dans le groupe.`)
    }
    if (student.conditionType === 'named_only') {
      if (named.state === 'empty') addPartnerCondition('fail', `La personne choisie par ${fullName(student)} n’est pas renseignée.`)
      else if (named.state === 'ambiguous') addPartnerCondition('review', `Plusieurs élèves correspondent au nom de la personne choisie par ${fullName(student)}.`)
      else if (!requestedNamed) addPartnerCondition('fail', `${fullName(student)} n’est pas avec le partenaire choisi en condition sine qua non.`)
      else addPartnerCondition('pass', `${fullName(student)} est avec le partenaire choisi en condition sine qua non.`)
    }
    if (student.conditionType === 'different_only') {
      if (regular.state === 'empty') addPartnerCondition('review', `Le correspondant actuel de ${fullName(student)} n’est pas renseigné : cette condition doit être vérifiée.`)
      else if (requestedRegular) addPartnerCondition('fail', `${fullName(student)} ne veut pas être avec ${matchedNames}.`)
      else if (hasAmbiguousRegularInGroup) addPartnerCondition('review', ambiguousRegular)
      else addPartnerCondition('pass', `${fullName(student)} n’est pas avec son correspondant habituel.`)
    }
    if (student.conditionType === 'none' && regular.state !== 'empty') {
      if (!requestedRegular && (regular.state === 'ambiguous' || hasAmbiguousRegularInGroup)) addOptional('review', ambiguousRegular)
      else addOptional(requestedRegular ? 'pass' : 'review', requestedRegular
        ? `${fullName(student)} retrouve ${matchedNames} parmi ses correspondants habituels.`
        : `Aucun correspondant habituel de ${fullName(student)} ne figure dans ce groupe (${student.regularCorrespondents}).`)
    }
    if (student.conditionType === 'none' && named.state !== 'empty') {
      addOptional(requestedNamed ? 'pass' : 'review', requestedNamed
        ? `${fullName(student)} est avec le partenaire choisi.`
        : `${fullName(student)} n’est pas avec le partenaire choisi (${student.namedPartner}).`)
    }
  }

  const regularLinks = regularLinksById.size
  const fullyReciprocal = members.length > 1 && members.every((student) => (
    regularLinksById.get(student.id)?.some((id) => regularLinksById.get(id)?.includes(student.id))
  ))
  let usualStatus = hasDifferentUsualPartner ? 'different' : 'unknown'
  if (hasAmbiguousUsualLink) usualStatus = 'ambiguous'
  if (regularLinks) usualStatus = fullyReciprocal ? 'mutual' : 'partial'

  if (members.length === 2 && members.every((student) => student.conditionType === 'none')) {
    if (usualStatus === 'mutual') addEssential('pass', 'Les deux élèves sont correspondants de base.')
    else if (!members.some((student) => student.regularCorrespondents?.trim() || student.namedPartner?.trim())) addEssential('pass', 'Choix du partenaire libre pour les deux élèves.')
  }

  if (bercher.length && brugg.length) {
    const trackPairs = bercher.flatMap((left) => brugg.map((right) => [getTrack(left), getTrack(right)]))
    const knownTrackPairs = trackPairs.filter(([left, right]) => left && right)
    if (knownTrackPairs.length && knownTrackPairs.every(([left, right]) => left === right)) addOptional('pass', 'Les élèves sont dans les filières privilégiées (VG–Sek / VP–Bez).')
    else if (knownTrackPairs.some(([left, right]) => left !== right)) addOptional('review', 'Les élèves ne sont pas dans les mêmes filières (préférence seulement).')
  }

  const cleanEssential = uniqueConditions(indispensable)
  const cleanOptional = uniqueConditions(optional)
  const conflicts = cleanEssential.filter((item) => item.state === 'fail').map((item) => item.label)
  const warnings = [...cleanEssential.filter((item) => item.state === 'review'), ...cleanOptional.filter((item) => item.state === 'review')].map((item) => item.label)
  const respected = [...cleanEssential.filter((item) => item.state === 'pass'), ...cleanOptional.filter((item) => item.state === 'pass')].map((item) => item.label)
  const rawScore = 100 - conflicts.length * 30 - warnings.length * 5
  const score = Math.max(0, Math.min(warnings.length ? 94 : 100, rawScore))
  return { score, respected, warnings, conflicts, hosting, usualStatus, regularLinks, memberConditions, conditions: { indispensable: cleanEssential, optional: cleanOptional } }
}

export function createPairingEvaluator(students, scenario) {
  const byId = new Map(students.map((student) => [student.id, student]))
  const resolveName = createNameResolver(students)
  const relations = new Map()
  const getRelations = (student) => {
    if (!relations.has(student.id)) {
      relations.set(student.id, {
        regular: resolveCorrespondents(student, resolveName),
        named: resolveName(student.namedPartner, oppositeSide(student), namedPartnerOptions),
      })
    }
    return relations.get(student.id)
  }
  return (memberIds, rotation = '') => evaluate(memberIds, rotation, byId, getRelations, scenario)
}

export function evaluatePairing(memberIds, students, rotation = '', scenario) {
  return createPairingEvaluator(students, scenario)(memberIds, rotation)
}

export function scenarioStats(scenario, students, evaluate = createPairingEvaluator(students, scenario)) {
  const studentsById = new Map(students.map((student) => [student.id, student]))
  const assigned = new Set(scenario.pairings.flatMap((pairing) => pairing.memberIds).filter((id) => studentsById.has(id) && isMaintainedInScenario(studentsById.get(id), scenario)))
  const eligible = students.filter((student) => student.participation !== 'host_only' && isMaintainedInScenario(student, scenario))
  const alertCount = scenario.pairings.filter((pairing) => evaluate(pairing.memberIds, pairing.rotation).conditions.indispensable.some((condition) => condition.state !== 'pass')).length
  const groupA = scenario.pairings.filter((pairing) => pairing.rotation === 'A').length
  const groupB = scenario.pairings.filter((pairing) => pairing.rotation === 'B').length
  const undecided = scenario.pairings.filter((pairing) => !pairing.rotation).length
  return { assigned: assigned.size, unassigned: eligible.filter((student) => !assigned.has(student.id)).length, alertCount, groupA, groupB, undecided }
}
