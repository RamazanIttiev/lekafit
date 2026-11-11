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
  status: z.enum(['DRAFT', 'SUBMITTED']),
  data: reportDataSchema,
  plan: planSchema.nullable(),
  submittedAt: z.string().nullable(),
})

export type Me = z.infer<typeof meSchema>
export type Report = z.infer<typeof reportSchema>
export type ReportData = Report['data']

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
