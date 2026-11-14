import {
  MEASURES,
  type MonthlyReportData,
  monthlyReportDataSchema,
  monthOfWeek,
  MONTHLY_METRICS,
  parseNumber,
  type Unit,
} from '@lekafit/shared'
import type { WeeklyReport } from './reports.repository'

type Values = Record<string, string>

const TOTALS: readonly string[] = ['training', 'cardio']
const WHOLE_UNITS: readonly Unit[] = ['ккал', 'шагов', 'раз', 'мин']

const numbersOf = (values: readonly Values[], key: string) =>
  values.flatMap((v) => {
    const n = parseNumber(v[key])
    return n === null ? [] : [n]
  })

const format = (n: number, unit: Unit) =>
  String(Number(n.toFixed(WHOLE_UNITS.includes(unit) ? 0 : 1)))

const combine = (numbers: readonly number[], total: boolean): number | null => {
  if (numbers.length === 0) return null
  const sum = numbers.reduce((a, b) => a + b, 0)
  return total ? sum : sum / numbers.length
}

const summarize = (
  fields: readonly { key: string; unit: Unit }[],
  values: readonly Values[],
): Values =>
  Object.fromEntries(
    fields.map((f) => {
      const n = combine(numbersOf(values, f.key), TOTALS.includes(f.key))
      return [f.key, n === null ? '' : format(n, f.unit)]
    }),
  )

const inMonth = (weeklies: readonly WeeklyReport[], month: string) =>
  weeklies.filter((w) => monthOfWeek(w.periodStart) === month)

const firstValues = (weeklies: readonly WeeklyReport[], kept: Values): Values => {
  const chronological = [...weeklies].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  return Object.fromEntries(
    MEASURES.map((m) => [
      m.key,
      kept[m.key] || chronological.find((w) => parseNumber(w.data.now[m.key]) !== null)?.data.now[m.key] || '',
    ]),
  )
}

export const computedMonthly = (input: {
  weeklies: readonly WeeklyReport[]
  month: string
  previousMonth: string
  keptBaseline: Values
}): Pick<MonthlyReportData, 'fact' | 'now' | 'prev' | 'baseline'> => {
  const submitted = input.weeklies.filter((w) => w.submittedAt !== null)
  const thisMonth = inMonth(submitted, input.month)
  const { fact, now, prev, baseline } = monthlyReportDataSchema.parse({
    fact: summarize(
      MONTHLY_METRICS,
      thisMonth.map((w) => w.data.fact),
    ),
    now: summarize(
      MEASURES,
      thisMonth.map((w) => w.data.now),
    ),
    prev: summarize(
      MEASURES,
      inMonth(submitted, input.previousMonth).map((w) => w.data.now),
    ),
    baseline: firstValues(submitted, input.keptBaseline),
  })
  return { fact, now, prev, baseline }
}
