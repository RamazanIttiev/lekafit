import { completionPercent, formatDelta, MEASURES, METRICS, parseNumber } from '@lekafit/shared'
import type { Report } from '../reports/reports.repository'
import type { User } from '../users/users.repository'

const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
const plain = (text: string) => text.replace(/[  ]/g, ' ')

const PERCENT_METRICS: ReadonlySet<string> = new Set(['steps', 'training'])

const clientName = (user: User) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.username ? `${name} (@${user.username})` : name
}

export const reportSummary = (report: Report, client: User): string => {
  const metricLines = METRICS.filter((m) => parseNumber(report.data.fact[m.key]) !== null).map(
    (m) => {
      const fact = parseNumber(report.data.fact[m.key])
      const plan = report.plan?.[m.key] ?? null
      const comparison = PERCENT_METRICS.has(m.key)
        ? completionPercent({ plan, fact })
        : formatDelta({ from: plan, to: fact, unit: m.unit })
      const planText = plan === null ? '—' : plan.toLocaleString('ru-RU')
      return `${m.label}: ${report.data.fact[m.key]} / ${planText} (${comparison})`
    },
  )
  const measureLines = MEASURES.filter(
    (m) =>
      parseNumber(report.data.now[m.key]) !== null && parseNumber(report.data.prev[m.key]) !== null,
  ).map((m) => {
    const delta = formatDelta({
      from: parseNumber(report.data.prev[m.key]),
      to: parseNumber(report.data.now[m.key]),
      unit: m.unit,
    })
    return `${m.label}: ${report.data.prev[m.key]} → ${report.data.now[m.key]} (${delta})`
  })

  return plain(
    [
      `📋 Новый отчёт: ${clientName(client)}`,
      `Неделя ${shortDate(report.weekStart)} — ${shortDate(report.weekEnd)}`,
      '',
      ...metricLines,
      ...(measureLines.length ? ['', ...measureLines] : []),
    ].join('\n'),
  )
}
