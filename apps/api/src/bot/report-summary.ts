import {
  formatDelta,
  MEASURES,
  METRICS,
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  monthName,
  parseNumber,
  type Unit,
} from '@lekafit/shared'
import type { MonthlyReport, Report, WeeklyReport } from '../reports/reports.repository'
import type { User } from '../users/users.repository'

const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
const plain = (text: string) => text.replace(/[  ]/g, ' ')

const clientName = (user: User) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.username ? `${name} (@${user.username})` : name
}

const filled = (value: string) => parseNumber(value) !== null

const delta = (from: string, to: string, unit: Unit) =>
  formatDelta({ from: parseNumber(from), to: parseNumber(to), unit })

const factLines = (
  metrics: readonly { key: string; label: string }[],
  fact: Record<string, string>,
) =>
  metrics.flatMap((m) => {
    const value = fact[m.key] ?? ''
    return filled(value) ? [`${m.label}: ${value}`] : []
  })

const weeklyMeasureLines = ({ data }: WeeklyReport) =>
  MEASURES.filter((m) => filled(data.now[m.key]) && filled(data.prev[m.key])).map(
    (m) =>
      `${m.label}: ${data.prev[m.key]} → ${data.now[m.key]} (${delta(data.prev[m.key], data.now[m.key], m.unit)})`,
  )

const monthlyMeasureLines = ({ data }: MonthlyReport) =>
  MONTHLY_MEASURES.flatMap((m) => {
    const now = data.now[m.key]
    const prev = data.prev[m.key]
    const start = data.baseline[m.key]
    const from = filled(prev) ? prev : start
    if (!filled(now) || !filled(from)) return []
    const changes = [
      ...(filled(prev) ? [`за месяц ${delta(prev, now, m.unit)}`] : []),
      ...(filled(start) ? [`от старта ${delta(start, now, m.unit)}`] : []),
    ]
    return [`${m.label}: ${from} → ${now} (${changes.join(', ')})`]
  })

const sections = (report: Report, client: User): string[][] =>
  report.kind === 'WEEKLY'
    ? [
        [
          `📋 Новый отчёт: ${clientName(client)}`,
          `Неделя ${shortDate(report.weekStart)} — ${shortDate(report.weekEnd)}`,
        ],
        factLines(METRICS, report.data.fact),
        weeklyMeasureLines(report),
      ]
    : [
        [`📋 Новый отчёт за месяц: ${clientName(client)}`, monthName(report.weekStart)],
        factLines(MONTHLY_METRICS, report.data.fact),
        monthlyMeasureLines(report),
      ]

export const reportSummary = (report: Report, client: User): string =>
  plain(
    sections(report, client)
      .filter((lines) => lines.length > 0)
      .map((lines) => lines.join('\n'))
      .join('\n\n'),
  )
