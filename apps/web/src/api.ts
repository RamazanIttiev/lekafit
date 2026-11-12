import { planSchema, reportDataSchema } from '@lekafit/shared'
import { z } from 'zod'

export const meSchema = z.object({
  id: z.number(),
  telegramId: z.number(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  role: z.enum(['CLIENT', 'COACH']),
})

export const reportSchema = z.object({
  id: z.number(),
  weekStart: z.string(),
  weekEnd: z.string(),
  data: reportDataSchema,
  plan: planSchema.nullable(),
  submittedAt: z.string().nullable(),
})

export type Me = z.infer<typeof meSchema>
export type Report = z.infer<typeof reportSchema>
export type ReportData = Report['data']

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

export const coachReportSchema = reportSchema.extend({ client: coachClientSchema })

export type CoachClient = z.infer<typeof coachClientSchema>
export type ClientListItem = z.infer<typeof clientListItemSchema>
export type ClientProfile = z.infer<typeof clientProfileSchema>
export type CoachReport = z.infer<typeof coachReportSchema>
export type Plan = NonNullable<Report['plan']>

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
  currentReport: () => Promise<Report>
  saveReport: (id: number, data: ReportData) => Promise<Report>
  submitReport: (id: number) => Promise<Report>
  listReports: () => Promise<Report[]>
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
  currentReport: () => request('/reports/current', reportSchema),
  saveReport: (id, data) =>
    request(`/reports/${id}`, reportSchema, { method: 'PATCH', body: { data } }),
  submitReport: (id) => request(`/reports/${id}/submit`, reportSchema, { method: 'POST' }),
  listReports: () => request('/reports', z.array(reportSchema)),
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
