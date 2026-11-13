export type ClientTab = 'current' | 'month' | 'progress'

const TABS: Record<string, ClientTab> = { week: 'current', month: 'month' }

export const clientTabFromLocation = ({ search }: { search: string }): ClientTab =>
  TABS[new URLSearchParams(search).get('tab') ?? ''] ?? 'current'
