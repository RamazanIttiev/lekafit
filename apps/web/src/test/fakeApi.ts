import {
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  monthlyReportDataSchema,
  type PhotoAngle,
  type Plan,
  type ReportData,
  reportDataSchema,
  WELLBEING,
} from '@lekafit/shared'
import type { Api, MonthlyReport, MonthlyReportData, WeeklyReport } from '../api'

export const aPlan = (overrides: Partial<Plan> = {}): Plan => ({
  cal: 1800,
  protein: 120,
  fat: 60,
  carb: 180,
  steps: 10000,
  training: 3,
  trainingMonth: null,
  cardioMonth: null,
  ...overrides,
})

export const aReport = (overrides: Partial<WeeklyReport> = {}): WeeklyReport => ({
  id: 1,
  kind: 'WEEKLY',
  periodStart: '2026-11-09',
  periodEnd: '2026-11-15',
  data: reportDataSchema.parse({}),
  plan: aPlan(),
  submittedAt: null,
  ...overrides,
})

export const aMonthlyReport = (overrides: Partial<MonthlyReport> = {}): MonthlyReport => ({
  id: 2,
  kind: 'MONTHLY',
  periodStart: '2026-11-09',
  periodEnd: '2026-12-09',
  data: monthlyReportDataSchema.parse({}),
  plan: aPlan(),
  submittedAt: null,
  photos: { front: false, side: false, back: false },
  prevPhotosReportId: null,
  ...overrides,
})

export const dataWith = (input: object): ReportData => reportDataSchema.parse(input)
export const monthlyDataWith = (input: object): MonthlyReportData =>
  monthlyReportDataSchema.parse(input)

const numbers = (keys: readonly { key: string }[]) =>
  Object.fromEntries(keys.map((k) => [k.key, '1']))

export const filledData = (): ReportData => {
  const measures = numbers(
    ['weight', 'chest', 'waist', 'hips', 'glutes', 'arm'].map((key) => ({ key })),
  )
  return reportDataSchema.parse({
    fact: numbers(['cal', 'protein', 'fat', 'carb', 'steps', 'training'].map((key) => ({ key }))),
    prev: measures,
    now: measures,
    wellbeing: {
      ...Object.fromEntries(WELLBEING.map((w) => [w.key, w.options[0]])),
      note: 'ок',
    },
    feedback: { wins: 'ок', issues: 'ок', changes: 'ок', nextWeek: 'ок' },
  })
}

export const filledMonthlyData = (): MonthlyReportData =>
  monthlyReportDataSchema.parse({
    fact: numbers(MONTHLY_METRICS),
    now: numbers(MONTHLY_MEASURES),
    wellbeing: Object.fromEntries(MONTHLY_WELLBEING.map((w) => [w.key, w.options[0]])),
    feedback: { wins: 'ок', issues: 'ок', changes: 'ок', questions: 'ок' },
  })

export const fakeApi = (
  options: {
    current?: WeeklyReport
    previous?: WeeklyReport
    monthly?: MonthlyReport
    history?: WeeklyReport[]
    monthlyHistory?: MonthlyReport[]
  } = {},
) => {
  const saves: ReportData[] = []
  const uploads: { id: number; angle: PhotoAngle; type: string }[] = []
  const monthlySaves: MonthlyReportData[] = []
  const state = {
    current: options.current ?? aReport(),
    previous:
      options.previous ?? aReport({ id: 3, periodStart: '2026-11-02', periodEnd: '2026-11-08' }),
    monthly: options.monthly ?? aMonthlyReport(),
  }
  const history = options.history ?? []
  const monthlyHistory = options.monthlyHistory ?? []
  const now = () => new Date().toISOString()
  const api: Api = {
    me: async () => ({
      id: 1,
      telegramId: 1,
      firstName: 'Анна',
      lastName: null,
      username: null,
      role: 'CLIENT',
    }),
    currentReport: async (week) => (week === 'previous' ? state.previous : state.current),
    currentMonthlyReport: async () => state.monthly,
    saveReport: async (id, data) => {
      if (id === state.monthly.id) {
        const monthly = monthlyReportDataSchema.parse(data)
        monthlySaves.push(monthly)
        state.monthly = { ...state.monthly, data: monthly }
        return state.monthly
      }
      const weekly = reportDataSchema.parse(data)
      if (id === state.previous.id) {
        state.previous = { ...state.previous, data: weekly }
        return state.previous
      }
      saves.push(weekly)
      state.current = { ...state.current, data: weekly }
      return state.current
    },
    submitReport: async (id) => {
      if (id === state.monthly.id) {
        state.monthly = { ...state.monthly, submittedAt: now() }
        return state.monthly
      }
      if (id === state.previous.id) {
        state.previous = { ...state.previous, submittedAt: now() }
        return state.previous
      }
      state.current = { ...state.current, submittedAt: now() }
      return state.current
    },
    listReports: async () => history,
    listMonthlyReports: async () => monthlyHistory,
    uploadPhoto: async (id, angle, photo) => {
      uploads.push({ id, angle, type: photo.type })
      state.monthly = { ...state.monthly, photos: { ...state.monthly.photos, [angle]: true } }
      return state.monthly
    },
    removePhoto: async (_id, angle) => {
      state.monthly = { ...state.monthly, photos: { ...state.monthly.photos, [angle]: false } }
      return state.monthly
    },
    photo: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
    getReport: async (id) => {
      const found = history.find((r) => r.id === id)
      if (!found) throw new Error('not found')
      return found
    },
  }
  return { api, saves, monthlySaves, uploads, state }
}
