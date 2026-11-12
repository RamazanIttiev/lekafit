export type Route =
  | { name: 'clients' }
  | { name: 'client'; id: number }
  | { name: 'report'; id: number }

export const parseRoute = (hash: string): Route => {
  const client = hash.match(/^#\/coach\/clients\/(\d+)$/)
  if (client?.[1]) return { name: 'client', id: Number(client[1]) }
  const report = hash.match(/^#\/coach\/reports\/(\d+)$/)
  if (report?.[1]) return { name: 'report', id: Number(report[1]) }
  return { name: 'clients' }
}

export const routeFromLocation = ({ search, hash }: { search: string; hash: string }): string => {
  const report = new URLSearchParams(search).get('report')
  return report && /^\d+$/.test(report) ? `#/coach/reports/${report}` : hash
}
