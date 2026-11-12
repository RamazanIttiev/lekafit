export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

export const period = (r: { weekStart: string; weekEnd: string }) =>
  `${shortDate(r.weekStart)} — ${shortDate(r.weekEnd)}`

export const plainNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('ru-RU')

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export const monthName = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
