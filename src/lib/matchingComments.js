export const MATCHING_COMMENT_LIMIT = 2000

export function getMatchingComments(entity) {
  return Array.isArray(entity?.matchingComments)
    ? entity.matchingComments.filter((entry) => typeof entry?.text === 'string' && entry.text.trim())
    : []
}

export function createMatchingComment(text, author) {
  const content = String(text ?? '').trim()
  if (!content || content.length > MATCHING_COMMENT_LIMIT) return null
  return { id: crypto.randomUUID(), text: content, author, at: new Date().toISOString() }
}

export function removeStudentComment(workspace, studentId, commentId) {
  const student = workspace.students.find(({ id }) => id === studentId)
  if (!student || !getMatchingComments(student).some(({ id }) => id === commentId)) return workspace
  return {
    ...workspace,
    students: workspace.students.map((item) => item === student
      ? { ...item, matchingComments: item.matchingComments.filter((entry) => entry?.id !== commentId) }
      : item),
  }
}

export function appendMatchingComment(workspace, target, comment) {
  const append = (entity) => ({
    ...entity,
    matchingComments: [...getMatchingComments(entity), comment],
  })

  if (target.studentId) {
    const student = workspace.students.find(({ id }) => id === target.studentId)
    if (!student) return workspace
    return {
      ...workspace,
      students: workspace.students.map((item) => item === student ? append(item) : item),
    }
  }

  const scenario = workspace.scenarios.find(({ id }) => id === target.scenarioId)
  const pairing = scenario?.pairings.find(({ id }) => id === target.pairingId)
  if (!pairing) return workspace
  return {
    ...workspace,
    scenarios: workspace.scenarios.map((item) => item === scenario ? {
      ...item,
      updatedAt: comment.at,
      pairings: item.pairings.map((group) => group === pairing ? append(group) : group),
    } : item),
  }
}
