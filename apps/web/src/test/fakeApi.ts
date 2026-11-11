import { type Plan, type ReportData, reportDataSchema, WELLBEING } from '@lekafit/shared'
import type { Api, Report } from '../api'

export const aPlan = (overrides: Partial<Plan> = {}): Plan => ({
  cal: 1800,
  protein: 120,
  fat: 60,
  carb: 180,
  steps: 10000,
  training: 3,
  ...overrides,
})

export const aReport = (overrides: Partial<Report> = {}): Report => ({
  id: 1,
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  status: 'DRAFT',
  data: reportDataSchema.parse({}),
  plan: aPlan(),
  submittedAt: null,
  ...overrides,
})

export const dataWith = (input: object): ReportData => reportDataSchema.parse(input)

export const filledData = (): ReportData => {
  const numbers = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, '1']))
  const measures = numbers(['weight', 'chest', 'waist', 'hips', 'glutes', 'arm'])
  return reportDataSchema.parse({
    fact: numbers(['cal', 'protein', 'fat', 'carb', 'steps', 'training']),
    prev: measures,
    now: measures,
    wellbeing: {
      ...Object.fromEntries(WELLBEING.map((w) => [w.key, w.options[0]])),
      note: 'ок',
    },
    feedback: { wins: 'ок', issues: 'ок', changes: 'ок', nextWeek: 'ок' },
  })
}

export const fakeApi = (options: { current?: Report; history?: Report[] } = {}) => {
  const saves: ReportData[] = []
  const state = { current: options.current ?? aReport() }
  const history = options.history ?? []
  const api: Api = {
    me: async () => ({
      id: 1,
      telegramId: 1,
      firstName: 'Анна',
      lastName: null,
      username: null,
      role: 'CLIENT',
    }),
    currentReport: async () => state.current,
    saveReport: async (_id, data) => {
      saves.push(data)
      state.current = { ...state.current, data }
      return state.current
    },
    submitReport: async () => {
      state.current = {
        ...state.current,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
      }
      return state.current
    },
    listReports: async () => history,
    getReport: async (id) => {
      const found = history.find((r) => r.id === id)
      if (!found) throw new Error('not found')
      return found
    },
  }
  return { api, saves, state }
}
