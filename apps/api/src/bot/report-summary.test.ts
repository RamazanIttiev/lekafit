import { reportDataSchema } from '@lekafit/shared'
import { describe, expect, it } from 'vitest'
import type { Report } from '../reports/reports.repository'
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

const aReport = (overrides: Omit<Partial<Report>, 'data'> & { data?: object } = {}): Report => ({
  id: 1,
  userId: 1,
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  status: 'SUBMITTED',
  plan: { cal: 1800, protein: 120, fat: 60, carb: 180, steps: 10000, training: 3 },
  submittedAt: null,
  seenByCoachAt: null,
  ...overrides,
  data: reportDataSchema.parse(overrides.data ?? {}),
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
