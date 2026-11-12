import { monthlyReportDataSchema, reportDataSchema } from '@lekafit/shared'
import { describe, expect, it } from 'vitest'
import type { MonthlyReport, WeeklyReport } from '../reports/reports.repository'
import type { User } from '../users/users.repository'
import { reportSummary } from './report-summary'

const aUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  telegramId: 5,
  firstName: 'Анна',
  lastName: 'Иванова',
  username: 'anna',
  role: 'CLIENT',
  ...overrides,
})

const aReport = (
  overrides: Omit<Partial<WeeklyReport>, 'data'> & { data?: object } = {},
): WeeklyReport => ({
  id: 1,
  kind: 'WEEKLY',
  userId: 1,
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  plan: {
    cal: 1800,
    protein: 120,
    fat: 60,
    carb: 180,
    steps: 10000,
    training: 3,
    trainingMonth: null,
    cardioMonth: null,
  },
  submittedAt: null,
  seenByCoachAt: null,
  ...overrides,
  data: reportDataSchema.parse(overrides.data ?? {}),
})

const aMonthlyReport = (
  data: object,
  photos: MonthlyReport['photos'] = { front: true, side: true, back: true },
): MonthlyReport => ({
  id: 2,
  kind: 'MONTHLY',
  userId: 1,
  weekStart: '2026-11-01',
  weekEnd: '2026-11-30',
  plan: null,
  submittedAt: null,
  seenByCoachAt: null,
  data: monthlyReportDataSchema.parse(data),
  photos,
  prevPhotosReportId: null,
})

describe('reportSummary for a monthly report', () => {
  it('names the month and shows changes over the month and since the start', () => {
    const text = reportSummary(
      aMonthlyReport({
        fact: { cal: '1850', cardio: '240' },
        baseline: { weight: '75' },
        prev: { weight: '72' },
        now: { weight: '71', thigh: '56' },
      }),
      aUser(),
    )
    expect(text).toBe(
      [
        '📋 Новый отчёт за месяц: Анна Иванова (@anna)',
        'Ноябрь 2026',
        '',
        'Калории: 1850',
        'Кардио: 240',
        '',
        'Вес: 72 → 71 (за месяц -1, от старта -4)',
        '',
        'Фото: 3 из 3',
      ].join('\n'),
    )
  })

  it('counts the photos that were added', () => {
    const text = reportSummary(
      aMonthlyReport({}, { front: true, side: false, back: false }),
      aUser(),
    )
    expect(text.endsWith('Фото: 1 из 3')).toBe(true)
  })

  it('shows only the change since the start in the first month', () => {
    const text = reportSummary(
      aMonthlyReport({ baseline: { waist: '70' }, now: { waist: '68' } }),
      aUser(),
    )
    expect(text).toContain('Талия: 70 → 68 (от старта -2)')
  })

  it('shows only the change over the month when no start value was recorded', () => {
    const text = reportSummary(
      aMonthlyReport({ prev: { weight: '72' }, now: { weight: '71' } }),
      aUser(),
    )
    expect(text).toContain('Вес: 72 → 71 (за месяц -1)')
  })
})

describe('reportSummary', () => {
  it('lays out header, metrics and measurements separated by blank lines', () => {
    const text = reportSummary(
      aReport({
        data: { fact: { cal: '1850' }, prev: { weight: '72' }, now: { weight: '71', waist: '70' } },
      }),
      aUser(),
    )
    expect(text).toBe(
      [
        '📋 Новый отчёт: Анна Иванова (@anna)',
        'Неделя 09.11 — 15.11',
        '',
        'Калории: 1850',
        '',
        'Вес: 72 → 71 (-1)',
      ].join('\n'),
    )
  })

  it('omits the measurement block when nothing was measured twice', () => {
    const text = reportSummary(
      aReport({ data: { fact: { cal: '1850' }, prev: { weight: '72' }, now: { waist: '70' } } }),
      aUser(),
    )
    expect(text.endsWith('Калории: 1850')).toBe(true)
  })

  it('shows only the reported value regardless of plan', () => {
    const text = reportSummary(aReport({ plan: null, data: { fact: { cal: '1850' } } }), aUser())
    expect(text).toContain('Калории: 1850')
    expect(text).not.toContain('/')
  })

  it('handles clients without last name or username', () => {
    const text = reportSummary(aReport(), aUser({ lastName: null, username: null }))
    expect(text.split('\n')[0]).toBe('📋 Новый отчёт: Анна')
  })
})
