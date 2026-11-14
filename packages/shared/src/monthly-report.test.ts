import { describe, expect, it } from 'vitest'
import {
  calendarMonth,
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  missingPhotos,
  monthlyMissingFields,
  monthlyReportDataSchema,
  monthOfWeek,
  photoFileName,
  previousCalendarMonth,
} from './index'

const filled = () =>
  monthlyReportDataSchema.parse({
    fact: Object.fromEntries(MONTHLY_METRICS.map((m) => [m.key, '1'])),
    now: Object.fromEntries(MONTHLY_MEASURES.map((m) => [m.key, '1'])),
    wellbeing: Object.fromEntries(MONTHLY_WELLBEING.map((w) => [w.key, w.options[0]])),
    feedback: { wins: 'a', issues: 'b', changes: 'c', questions: 'd' },
  })

describe('calendarMonth', () => {
  it('covers the 1st through the last day of the month', () => {
    expect(calendarMonth('2026-11-14')).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(calendarMonth('2028-02-03')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('previousCalendarMonth', () => {
  it('is the whole month before the given date', () => {
    expect(previousCalendarMonth('2026-12-01')).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(previousCalendarMonth('2027-01-31')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })
})

describe('monthOfWeek', () => {
  it('assigns a week to the month that holds most of its days', () => {
    expect(monthOfWeek('2026-10-26')).toBe('2026-10')
    expect(monthOfWeek('2026-11-30')).toBe('2026-12')
    expect(monthOfWeek('2026-12-28')).toBe('2026-12')
    expect(monthOfWeek('2027-03-29')).toBe('2027-04')
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

  it('does not ask the client for nutrition, activity or measurements, which come from weekly reports', () => {
    const data = filled()
    expect(
      monthlyMissingFields({
        ...data,
        fact: monthlyReportDataSchema.parse({}).fact,
        now: monthlyReportDataSchema.parse({}).now,
      }),
    ).toEqual([])
  })

  it('lists missing wellbeing and feedback fields', () => {
    const data = filled()
    expect(
      monthlyMissingFields({
        ...data,
        wellbeing: { ...data.wellbeing, planEase: '' },
        feedback: { ...data.feedback, questions: ' ' },
      }),
    ).toEqual(['wellbeing.planEase', 'feedback.questions'])
  })
})

describe('missingPhotos', () => {
  it('lists the angles without a photo, in front, side, back order', () => {
    expect(missingPhotos({ front: false, side: true, back: false })).toEqual([
      'photos.front',
      'photos.back',
    ])
  })

  it('is empty when all three are there', () => {
    expect(missingPhotos({ front: true, side: true, back: true })).toEqual([])
  })
})

describe('photoFileName', () => {
  const base = { clientName: 'Анна  Иванова', periodStart: '2026-11-09', angle: 'side' as const }

  it('joins client, month and angle with underscores', () => {
    expect(photoFileName({ ...base, mime: 'image/jpeg' })).toBe(
      'LekaFit_Анна_Иванова_2026-11-09_side.jpg',
    )
  })

  it('uses the extension of the image type', () => {
    expect(photoFileName({ ...base, mime: 'image/png' })).toBe(
      'LekaFit_Анна_Иванова_2026-11-09_side.png',
    )
    expect(photoFileName({ ...base, mime: 'image/webp' })).toBe(
      'LekaFit_Анна_Иванова_2026-11-09_side.webp',
    )
  })

  it('leaves the name out when there is none', () => {
    expect(photoFileName({ ...base, clientName: ' ', mime: 'image/jpeg' })).toBe(
      'LekaFit_2026-11-09_side.jpg',
    )
  })
})
