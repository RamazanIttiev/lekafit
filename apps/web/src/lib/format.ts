export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

export const period = (r: { weekStart: string; weekEnd: string }) =>
  `${shortDate(r.weekStart)} — ${shortDate(r.weekEnd)}`

export const plainNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('ru-RU')

export { monthName } from '@lekafit/shared'
