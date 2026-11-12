import { monthlyReportDataSchema, planSchema, reportDataSchema } from '@lekafit/shared'
import { z } from 'zod'

export const meSchema = z.object({
  id: z.number(),
  telegramId: z.number(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  role: z.enum(['CLIENT', 'COACH']),
})

const reportFields = {
  id: z.number(),
  weekStart: z.string(),
  weekEnd: z.string(),
  plan: planSchema.nullable(),
  submittedAt: z.string().nullable(),
}

export const weeklyReportSchema = z.object({
  ...reportFields,
  kind: z.literal('WEEKLY'),
  data: reportDataSchema,
})

export const monthlyReportSchema = z.object({
  ...reportFields,
  kind: z.literal('MONTHLY'),
  data: monthlyReportDataSchema,
})

export const reportSchema = z.discriminatedUnion('kind', [weeklyReportSchema, monthlyReportSchema])

export type Me = z.infer<typeof meSchema>
export type WeeklyReport = z.infer<typeof weeklyReportSchema>
export type MonthlyReport = z.infer<typeof monthlyReportSchema>
export type Report = WeeklyReport | MonthlyReport
export type ReportData = WeeklyReport['data']
export type MonthlyReportData = MonthlyReport['data']

export const coachClientSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
})

export const clientListItemSchema = coachClientSchema.extend({
  lastReportWeek: z.string().nullable(),
  unseenReports: z.number(),
})

export const clientProfileSchema = coachClientSchema.extend({ plan: planSchema.nullable() })

export const coachReportSchema = z.discriminatedUnion('kind', [
  weeklyReportSchema.extend({ client: coachClientSchema }),
  monthlyReportSchema.extend({ client: coachClientSchema }),
])

export type CoachClient = z.infer<typeof coachClientSchema>
export type ClientListItem = z.infer<typeof clientListItemSchema>
export type ClientProfile = z.infer<typeof clientProfileSchema>
export type CoachReport = z.infer<typeof coachReportSchema>
export type Plan = NonNullable<WeeklyReport['plan']>

export type CoachApi = {
  clients: () => Promise<ClientListItem[]>
  client: (id: number) => Promise<ClientProfile>
  setPlan: (id: number, plan: Plan) => Promise<Plan>
  clientReports: (id: number) => Promise<Report[]>
  report: (id: number) => Promise<CoachReport>
  invite: () => Promise<{ url: string }>
}

export type Api = {
  me: () => Promise<Me>
  currentReport: () => Promise<WeeklyReport>
  currentMonthlyReport: () => Promise<MonthlyReport>
  saveReport: (id: number, data: ReportData | MonthlyReportData) => Promise<Report>
  submitReport: (id: number) => Promise<Report>
  listReports: () => Promise<WeeklyReport[]>
  listMonthlyReports: () => Promise<MonthlyReport[]>
  getReport: (id: number) => Promise<Report>
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const errorBody = z.object({ message: z.string() })

export type Request = <S extends z.ZodType>(
  path: string,
  schema: S,
  init?: { method?: string; body?: unknown },
) => Promise<z.infer<S>>

export const httpClient =
  ({ baseUrl, initData }: { baseUrl: string; initData: string }): Request =>
  async (path, schema, init = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `tma ${initData}`, 'Content-Type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const parsed = errorBody.safeParse(body)
      throw new ApiError(
        res.status,
        parsed.success ? parsed.data.message : 'Не удалось связаться с сервером',
      )
    }
    return schema.parse(body)
  }

export const createApi = (request: Request): Api => ({
  me: () => request('/me', meSchema),
  currentReport: () => request('/reports/current', weeklyReportSchema),
  currentMonthlyReport: () => request('/reports/current?kind=monthly', monthlyReportSchema),
  saveReport: (id, data) =>
    request(`/reports/${id}`, reportSchema, { method: 'PATCH', body: { data } }),
  submitReport: (id) => request(`/reports/${id}/submit`, reportSchema, { method: 'POST' }),
  listReports: () => request('/reports', z.array(weeklyReportSchema)),
  listMonthlyReports: () => request('/reports?kind=monthly', z.array(monthlyReportSchema)),
  getReport: (id) => request(`/reports/${id}`, reportSchema),
})

export const createCoachApi = (request: Request): CoachApi => ({
  clients: () => request('/coach/clients', z.array(clientListItemSchema)),
  client: (id) => request(`/coach/clients/${id}`, clientProfileSchema),
  setPlan: (id, plan) =>
    request(`/coach/clients/${id}/plan`, planSchema, { method: 'PUT', body: plan }),
  clientReports: (id) => request(`/coach/clients/${id}/reports`, z.array(reportSchema)),
  report: (id) => request(`/coach/reports/${id}`, coachReportSchema),
  invite: () => request('/coach/invite', z.object({ url: z.string() })),
})
