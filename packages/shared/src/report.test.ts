import { describe, expect, it } from 'vitest'
import {
  completionPercent,
  formatDelta,
  missingFields,
  parseNumber,
  planSchema,
  reportDataSchema,
  WELLBEING,
  weekRange,
} from './index'

describe('parseNumber', () => {
  it.each([
    ['1850', 1850],
    ['1 850', 1850],
    ['1 850', 1850],
    ['72,4', 72.4],
    [' 0 ', 0],
    ['-3', -3],
  ])('parses %j as %d', (input, expected) => {
    expect(parseNumber(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1,2,3', undefined, null])('returns null for %j', (input) => {
    expect(parseNumber(input)).toBeNull()
  })
})

describe('formatDelta', () => {
  it('shows a plus sign and no decimals for calories', () => {
    expect(formatDelta({ from: 1800, to: 1850.4, unit: 'ккал' })).toBe('+50')
  })

  it('shows no decimals for steps and workouts', () => {
    expect(formatDelta({ from: 8000, to: 10000, unit: 'шагов' })).toBe('+2 000')
    expect(formatDelta({ from: 4, to: 3, unit: 'раз' })).toBe('-1')
  })

  it('keeps one decimal with a comma for kg and cm', () => {
    expect(formatDelta({ from: 72.4, to: 71.9, unit: 'кг' })).toBe('-0,5')
    expect(formatDelta({ from: 80, to: 80.25, unit: 'см' })).toBe('+0,3')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatDelta({ from: 70, to: 71, unit: 'кг' })).toBe('+1')
  })

  it('shows zero without a sign', () => {
    expect(formatDelta({ from: 120, to: 120, unit: 'г' })).toBe('0')
  })

  it('returns a dash when either side is missing', () => {
    expect(formatDelta({ from: null, to: 5, unit: 'г' })).toBe('—')
    expect(formatDelta({ from: 5, to: null, unit: 'г' })).toBe('—')
  })
})

describe('completionPercent', () => {
  it('rounds fact over plan to a whole percent', () => {
    expect(completionPercent({ plan: 3, fact: 2 })).toBe('67%')
    expect(completionPercent({ plan: 10000, fact: 12500 })).toBe('125%')
  })

  it('returns a dash when plan is zero, negative or missing, or fact is missing', () => {
    expect(completionPercent({ plan: 0, fact: 2 })).toBe('—')
    expect(completionPercent({ plan: -1, fact: 2 })).toBe('—')
    expect(completionPercent({ plan: null, fact: 2 })).toBe('—')
    expect(completionPercent({ plan: 3, fact: null })).toBe('—')
  })
})

describe('weekRange', () => {
  it('returns Monday to Sunday of the week containing the date', () => {
    expect(weekRange(new Date(2026, 10, 11))).toEqual({ start: '2026-11-09', end: '2026-11-15' })
  })

  it('treats Sunday as the last day of the week', () => {
    expect(weekRange(new Date(2026, 10, 15))).toEqual({ start: '2026-11-09', end: '2026-11-15' })
  })

  it('handles Monday and month boundaries', () => {
    expect(weekRange(new Date(2026, 10, 30))).toEqual({ start: '2026-11-30', end: '2026-12-06' })
  })
})

const filledReport = (overrides: Record<string, Record<string, string>> = {}) => {
  const section = (keys: readonly string[], value: string, patch: Record<string, string> = {}) =>
    Object.fromEntries(keys.map((k) => [k, patch[k] ?? value]))
  return reportDataSchema.parse({
    fact: section(['cal', 'protein', 'fat', 'carb', 'steps', 'training'], '1', overrides.fact),
    prev: section(['weight', 'chest', 'waist', 'hips', 'glutes', 'arm'], '1', overrides.prev),
    now: section(['weight', 'chest', 'waist', 'hips', 'glutes', 'arm'], '1', overrides.now),
    wellbeing: {
      ...Object.fromEntries(
        WELLBEING.map((w) => [w.key, overrides.wellbeing?.[w.key] ?? w.options[0]]),
      ),
      note: 'ok',
    },
    feedback: section(['wins', 'issues', 'changes', 'nextWeek'], 'ok', overrides.feedback),
  })
}

describe('reportDataSchema', () => {
  it('fills every field with empty strings when given nothing', () => {
    const data = reportDataSchema.parse({})
    expect(data.fact.cal).toBe('')
    expect(data.prev.weight).toBe('')
    expect(data.wellbeing.sleep).toBe('')
    expect(data.feedback.wins).toBe('')
  })

  it('rejects wellbeing values outside the allowed options', () => {
    expect(reportDataSchema.safeParse({ wellbeing: { sleep: 'всегда' } }).success).toBe(false)
  })

  it('accepts allowed wellbeing options', () => {
    expect(reportDataSchema.safeParse({ wellbeing: { energy: '4 — хорошая' } }).success).toBe(true)
  })
})

describe('missingFields', () => {
  it('lists every field of an empty report', () => {
    expect(missingFields(reportDataSchema.parse({}))).toHaveLength(6 + 6 + 6 + 4)
  })

  it('names a field by its section and key', () => {
    const data = filledReport({ fact: { cal: '' }, wellbeing: { sleep: '' } })
    expect(missingFields(data)).toEqual(['fact.cal', 'wellbeing.sleep'])
  })

  it('treats blank text and non-numeric measurements as missing', () => {
    const data = filledReport({ feedback: { wins: '   ' }, now: { weight: 'abc' } })
    expect(missingFields(data)).toEqual(['now.weight', 'feedback.wins'])
  })

  it('does not require "before" measurements, which come from the previous report', () => {
    const data = filledReport({ prev: { weight: '', waist: '' } })
    expect(missingFields(data)).toEqual([])
  })

  it('does not require the wellbeing comment', () => {
    const data = reportDataSchema.parse({
      ...filledReport(),
      wellbeing: { ...filledReport().wellbeing, note: '' },
    })
    expect(missingFields(data)).toEqual([])
  })

  it('returns nothing when every field is filled', () => {
    expect(missingFields(filledReport())).toEqual([])
  })
})

describe('formatDelta rounding for whole units', () => {
  it('rounds fractional steps and workouts to whole numbers', () => {
    expect(formatDelta({ from: 8000, to: 8000.6, unit: 'шагов' })).toBe('+1')
    expect(formatDelta({ from: 3, to: 3.6, unit: 'раз' })).toBe('+1')
  })
})

describe('weekRange zero padding', () => {
  it('pads single-digit months and days', () => {
    expect(weekRange(new Date(2026, 2, 4))).toEqual({ start: '2026-03-02', end: '2026-03-08' })
  })
})

describe('reportDataSchema limits', () => {
  it('accepts an explicitly cleared wellbeing option', () => {
    expect(reportDataSchema.safeParse({ wellbeing: { sleep: '' } }).success).toBe(true)
  })

  it('accepts long but reasonable feedback and rejects over 4000 characters', () => {
    expect(reportDataSchema.safeParse({ feedback: { wins: 'а'.repeat(4000) } }).success).toBe(true)
    expect(reportDataSchema.safeParse({ feedback: { wins: 'а'.repeat(4001) } }).success).toBe(false)
  })
})

describe('planSchema', () => {
  it('requires every metric as a non-negative number or null', () => {
    const plan = { cal: 1800, protein: 120, fat: 60, carb: 180, steps: 10000, training: null }
    expect(planSchema.parse(plan)).toEqual(plan)
    expect(planSchema.safeParse({ ...plan, cal: undefined }).success).toBe(false)
    expect(planSchema.safeParse({ ...plan, steps: -1 }).success).toBe(false)
  })
})
