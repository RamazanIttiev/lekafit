export type ReportTab = 'week' | 'month'

export const reportTabUrl = (webAppUrl: string, tab: ReportTab): string =>
  `${webAppUrl}/?tab=${tab}`
