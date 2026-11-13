const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

export const moscowIsoDate = (now: Date): string =>
  new Date(now.getTime() + MOSCOW_OFFSET_MS).toISOString().slice(0, 10)

export const moscowToday = (now: Date): Date => {
  const iso = moscowIsoDate(now)
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}
