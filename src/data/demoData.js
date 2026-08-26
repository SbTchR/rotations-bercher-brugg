const now = '2026-08-26T18:00:00.000Z'

const student = (id, side, suffix, values = {}) => ({
  id,
  side,
  firstName: 'Élève',
  lastName: suffix,
  school: side === 'bercher' ? 'Bercher' : values.school || 'Bezirksschule',
  className: values.className || (side === 'bercher' ? '11VG1' : 'B3a'),
  gender: values.gender || 'unspecified',
  participation: values.participation || 'exchange_and_host',
  conditionType: values.conditionType || 'none',
  namedPartner: values.namedPartner || '',
  regularCorrespondents: values.regularCorrespondents || '',
  canHost: values.canHost ?? true,
  maxGuests: values.maxGuests ?? 1,
  acceptsOtherGender: values.acceptsOtherGender ?? true,
  animals: values.animals || '',
  rotation: values.rotation || '',
  groupPreference: values.groupPreference || '',
  notes: values.notes || '',
  studentPhone: '',
  parentPhone: '',
  address: '',
  sharePhones: true,
  status: values.status || 'complete',
  assignmentHint: values.assignmentHint || '',
  ...values,
})

export const createDemoWorkspace = () => ({
  meta: {
    id: 'demo-workspace',
    title: 'Échange 2026–2027',
    schoolYear: '2026–2027',
    status: 'preparation',
    groupA: 'Bercher → Brugg du 7 au 11 mars · Brugg → Bercher du 11 au 15 mars',
    groupB: 'Brugg → Bercher du 7 au 11 mars · Bercher → Brugg du 11 au 15 mars',
  },
  students: [
    student('b01', 'bercher', 'B-01', { className: '11VG1', gender: 'female', rotation: 'A', regularCorrespondents: 'Élève R-04', conditionType: 'regular_only' }),
    student('b02', 'bercher', 'B-02', { className: '11VG1', gender: 'male', rotation: 'B', participation: 'travel_no_host', canHost: false, status: 'review' }),
    student('b03', 'bercher', 'B-03', { className: '11VP2', gender: 'female', rotation: 'A', acceptsOtherGender: false }),
    student('b04', 'bercher', 'B-04', { className: '11VG2', gender: 'male', rotation: 'A' }),
    student('b05', 'bercher', 'B-05', { className: '11VP1', gender: 'female', rotation: 'B', regularCorrespondents: 'Élève R-08', conditionType: 'regular_only' }),
    student('b06', 'bercher', 'B-06', { className: '11VG1', gender: 'male', rotation: 'B', acceptsOtherGender: false }),
    student('b07', 'bercher', 'B-07', { className: '11VG4', gender: 'female', rotation: 'B', participation: 'host_only', maxGuests: 2 }),
    student('r02', 'brugg', 'R-02', { school: 'Bezirksschule', className: 'B1a', gender: 'female', rotation: 'B' }),
    student('r04', 'brugg', 'R-04', { school: 'Bezirksschule', className: 'B3a', gender: 'female', rotation: 'A', regularCorrespondents: 'Élève B-01', conditionType: 'regular_only' }),
    student('r05', 'brugg', 'R-05', { school: 'Bezirksschule', className: 'B3a', gender: 'male', rotation: 'B' }),
    student('r06', 'brugg', 'R-06', { school: 'Sekundarschule', className: 'S3b', gender: 'female', rotation: 'A', acceptsOtherGender: false }),
    student('r07', 'brugg', 'R-07', { school: 'Sekundarschule', className: 'S3b', gender: 'male', rotation: 'A' }),
    student('r08', 'brugg', 'R-08', { school: 'Bezirksschule', className: 'B3b', gender: 'female', rotation: 'B', regularCorrespondents: 'Élève B-05', conditionType: 'regular_only' }),
    student('r09', 'brugg', 'R-09', { school: 'Bezirksschule', className: 'B3a', gender: 'male', rotation: 'A', maxGuests: 2 }),
    student('r10', 'brugg', 'R-10', { school: 'Bezirksschule', className: 'B3a', gender: 'female', rotation: 'A' }),
    student('r11', 'brugg', 'R-11', { school: 'Sekundarschule', className: 'S3b', gender: 'male', rotation: 'A' }),
  ],
  scenarios: [
    {
      id: 'scenario-1',
      name: 'Proposition 1',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      pairings: [
        { id: 'pair-1', memberIds: ['b01', 'r04'], rotation: 'A', locked: true, notes: '' },
        { id: 'pair-2', memberIds: ['b04', 'r07'], rotation: 'A', locked: false, notes: '' },
        { id: 'pair-3', memberIds: ['b05', 'r10', 'r11'], rotation: 'A', locked: true, notes: 'Groupe d’accueil à confirmer.' },
        { id: 'pair-4', memberIds: ['b02', 'r02'], rotation: 'B', locked: false, notes: '' },
      ],
    },
    {
      id: 'scenario-2',
      name: 'Proposition 2',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      pairings: [
        { id: 'pair-5', memberIds: ['b01', 'r04'], rotation: 'A', locked: true, notes: '' },
        { id: 'pair-6', memberIds: ['b05', 'r08'], rotation: 'B', locked: false, notes: '' },
      ],
    },
  ],
  activeScenarioId: 'scenario-1',
  activity: [],
})

export const createBlankWorkspace = () => {
  const id = crypto.randomUUID()
  const stamp = new Date().toISOString()
  return {
    meta: {
      id: 'new-workspace',
      title: 'Échange 2026–2027',
      schoolYear: '2026–2027',
      status: 'preparation',
      groupA: 'Bercher → Brugg, puis Brugg → Bercher',
      groupB: 'Brugg → Bercher, puis Bercher → Brugg',
    },
    students: [],
    scenarios: [{ id, name: 'Proposition 1', status: 'draft', createdAt: stamp, updatedAt: stamp, pairings: [] }],
    activeScenarioId: id,
    activity: [],
  }
}

export const blankStudent = (side = 'bercher') => student(crypto.randomUUID(), side, '', {
  firstName: '',
  lastName: '',
  school: side === 'bercher' ? 'Bercher' : 'Bezirksschule',
  className: '',
  canHost: true,
  status: 'review',
})

export const normalizeWorkspace = (value) => {
  const demo = createDemoWorkspace()
  if (!value || !Array.isArray(value.students) || !Array.isArray(value.scenarios)) return demo
  return {
    ...demo,
    ...value,
    meta: { ...demo.meta, ...(value.meta || {}) },
    students: value.students,
    scenarios: value.scenarios.length ? value.scenarios : demo.scenarios,
    activeScenarioId: value.activeScenarioId || value.scenarios[0]?.id || demo.activeScenarioId,
    activity: Array.isArray(value.activity) ? value.activity : [],
  }
}
