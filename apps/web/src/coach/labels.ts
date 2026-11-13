import type { Report } from '../api'
import { period } from '../lib/format'

export const fullName = (c: { firstName: string; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ')

export const reportTitle = (r: Report) =>
  r.kind === 'WEEKLY' ? `Отчёт ${period(r)}` : `Отчёт за ${period(r)}`
