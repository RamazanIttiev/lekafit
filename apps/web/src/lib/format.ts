export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

export const period = (r: { periodStart: string; periodEnd: string }) =>
  r.periodStart === r.periodEnd
    ? shortDate(r.periodStart)
    : `${shortDate(r.periodStart)} — ${shortDate(r.periodEnd)}`

export const plainNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('ru-RU')
