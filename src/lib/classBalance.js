const blankHalf = () => ({ outgoing: 0, incoming: 0, net: 0 })

const classKey = (student) => `${student.side}|${student.school}|${student.className}`

const naturalCompare = (left, right) => left.localeCompare(right, 'fr-CH', { numeric: true, sensitivity: 'base' })

export function calculateClassBalances(scenario, students) {
  const byId = new Map(students.map((student) => [student.id, student]))
  const rows = new Map()
  const ensureStudentClass = (student) => {
    if (!student?.className) return null
    const key = classKey(student)
    if (!rows.has(key)) rows.set(key, {
      key,
      side: student.side,
      school: student.school,
      className: student.className,
      first: blankHalf(),
      second: blankHalf(),
    })
    return rows.get(key)
  }
  students.forEach(ensureStudentClass)

  let undecidedPairings = 0
  for (const pairing of scenario?.pairings || []) {
    if (!pairing.rotation) {
      undecidedPairings += 1
      continue
    }
    const members = pairing.memberIds.map((id) => byId.get(id)).filter((student) => student?.active !== false)
    const bercher = members.filter((student) => student.side === 'bercher')
    const brugg = members.filter((student) => student.side === 'brugg')
    if (!bercher.length || !brugg.length) continue

    const bercherHostClass = pairing.bercherHostClass || bercher[0].className
    const bruggHostClass = pairing.bruggHostClass || brugg[0].className
    const bercherHost = rows.get(`${bercher[0].side}|${bercher[0].school}|${bercherHostClass}`) || ensureStudentClass(bercher[0])
    const bruggHostStudent = brugg.find((student) => student.className === bruggHostClass) || brugg[0]
    const bruggHost = rows.get(`${bruggHostStudent.side}|${bruggHostStudent.school}|${bruggHostClass}`) || ensureStudentClass(bruggHostStudent)

    const bercherTravelHalf = pairing.rotation === 'A' ? 'first' : 'second'
    const bruggTravelHalf = pairing.rotation === 'A' ? 'second' : 'first'

    for (const student of bercher) if (student.participation !== 'host_only') ensureStudentClass(student)[bercherTravelHalf].outgoing += 1
    for (const student of brugg) if (student.participation !== 'host_only') ensureStudentClass(student)[bruggTravelHalf].outgoing += 1
    bruggHost[bercherTravelHalf].incoming += bercher.length
    bercherHost[bruggTravelHalf].incoming += brugg.length
  }

  const balances = [...rows.values()].map((row) => ({
    ...row,
    first: { ...row.first, net: row.first.incoming - row.first.outgoing },
    second: { ...row.second, net: row.second.incoming - row.second.outgoing },
  })).sort((left, right) => {
    const sideOrder = left.side === right.side ? 0 : left.side === 'bercher' ? -1 : 1
    return sideOrder || naturalCompare(left.school, right.school) || naturalCompare(left.className, right.className)
  })

  return { balances, undecidedPairings }
}
