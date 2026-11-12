import { describe, expect, it } from 'vitest'
import {
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  missingPhotos,
  monthlyMissingFields,
  monthlyReportDataSchema,
  monthName,
  monthRange,
  photoFileName,
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

describe('monthName', () => {
  it.each([
    ['2026-01-01', 'Январь 2026'],
    ['2026-02-01', 'Февраль 2026'],
    ['2026-03-01', 'Март 2026'],
    ['2026-04-01', 'Апрель 2026'],
    ['2026-05-01', 'Май 2026'],
    ['2026-06-01', 'Июнь 2026'],
    ['2026-07-01', 'Июль 2026'],
    ['2026-08-01', 'Август 2026'],
    ['2026-09-01', 'Сентябрь 2026'],
    ['2026-10-01', 'Октябрь 2026'],
    ['2026-11-01', 'Ноябрь 2026'],
    ['2027-12-31', 'Декабрь 2027'],
  ])('names %s as %s', (iso, name) => {
    expect(monthName(iso)).toBe(name)
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
  const base = { clientName: 'Анна  Иванова', monthStart: '2026-11-01', angle: 'side' as const }

  it('joins client, month and angle with underscores', () => {
    expect(photoFileName({ ...base, mime: 'image/jpeg' })).toBe(
      'LekaFit_Анна_Иванова_2026-11_side.jpg',
    )
  })

  it('uses the extension of the image type', () => {
    expect(photoFileName({ ...base, mime: 'image/png' })).toBe(
      'LekaFit_Анна_Иванова_2026-11_side.png',
    )
    expect(photoFileName({ ...base, mime: 'image/webp' })).toBe(
      'LekaFit_Анна_Иванова_2026-11_side.webp',
    )
  })

  it('leaves the name out when there is none', () => {
    expect(photoFileName({ ...base, clientName: ' ', mime: 'image/jpeg' })).toBe(
      'LekaFit_2026-11_side.jpg',
    )
  })
})
