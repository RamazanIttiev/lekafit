import { describe, expect, it } from 'vitest'
import {
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  monthlyMissingFields,
  monthlyReportDataSchema,
  monthRange,
} from './index'

const filled = () =>
  monthlyReportDataSchema.parse({
    fact: Object.fromEntries(MONTHLY_METRICS.map((m) => [m.key, '1'])),
    now: Object.fromEntries(MONTHLY_MEASURES.map((m) => [m.key, '1'])),
    wellbeing: Object.fromEntries(MONTHLY_WELLBEING.map((w) => [w.key, w.options[0]])),
    feedback: { wins: 'a', issues: 'b', changes: 'c', questions: 'd' },
  })

describe('monthRange', () => {
  it('returns first and last day of the month', () => {
    expect(monthRange(new Date(2026, 10, 12))).toEqual({ start: '2026-11-01', end: '2026-11-30' })
  })

  it('handles February in a leap year and December', () => {
    expect(monthRange(new Date(2028, 1, 29))).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(monthRange(new Date(2026, 11, 31))).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })
})

describe('monthlyReportDataSchema', () => {
  it('defaults every section to empty values', () => {
    const data = monthlyReportDataSchema.parse({})
    expect(data.fact.cardio).toBe('')
    expect(data.baseline.thigh).toBe('')
    expect(data.wellbeing.planEase).toBe('')
    expect(data.feedback.questions).toBe('')
    expect(data.about).toEqual({ startDate: '', goal: '' })
  })

  it('rejects an option that is not on the scale', () => {
    expect(monthlyReportDataSchema.safeParse({ wellbeing: { healthChange: 'meh' } }).success).toBe(
      false,
    )
  })

  it('rejects a start date longer than an ISO date', () => {
    expect(monthlyReportDataSchema.safeParse({ about: { startDate: '2026-11-012' } }).success).toBe(
      false,
    )
  })

  it('rejects an unknown goal', () => {
    expect(
      monthlyReportDataSchema.safeParse({ about: { goal: 'Стать космонавтом' } }).success,
    ).toBe(false)
  })
})

describe('monthlyMissingFields', () => {
  it('reports nothing for a fully filled report', () => {
    expect(monthlyMissingFields(filled())).toEqual([])
  })

  it('does not require cardio', () => {
    const data = filled()
    expect(monthlyMissingFields({ ...data, fact: { ...data.fact, cardio: '' } })).toEqual([])
  })

  it('lists missing fact, measure, wellbeing and feedback fields', () => {
    const data = filled()
    expect(
      monthlyMissingFields({
        ...data,
        fact: { ...data.fact, steps: '' },
        now: { ...data.now, thigh: '' },
        wellbeing: { ...data.wellbeing, planEase: '' },
        feedback: { ...data.feedback, questions: ' ' },
      }),
    ).toEqual(['fact.steps', 'now.thigh', 'wellbeing.planEase', 'feedback.questions'])
  })
})
