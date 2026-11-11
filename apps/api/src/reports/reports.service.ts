import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { MEASURES, type ReportData, reportDataSchema, weekRange } from '@lekafit/shared'
import { type AppConfig, CONFIG } from '../config'
import { type Report, ReportsRepository } from './reports.repository'

export const REPORT_SUBMITTED = Symbol('REPORT_SUBMITTED')
export type ReportSubmittedListener = (report: Report) => Promise<void>

const DAYS_BACK_FOR_REPORTING_WEEK = 3

const reportingWeek = (now: Date) =>
  weekRange(new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_BACK_FOR_REPORTING_WEEK))

const prefilledFrom = (previous: Report | null): ReportData => {
  const empty = reportDataSchema.parse({})
  if (!previous) return empty
  const prev = Object.fromEntries(MEASURES.map((m) => [m.key, previous.data.now[m.key]]))
  return reportDataSchema.parse({ ...empty, prev })
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(REPORT_SUBMITTED) private readonly onSubmitted: ReportSubmittedListener,
  ) {}

  async current(userId: number): Promise<Report> {
    const week = reportingWeek(this.config.now())
    const existing = await this.reports.findForWeek(userId, week.start)
    if (existing) return existing
    const data = prefilledFrom(await this.reports.lastSubmitted(userId))
    return this.reports.create({ userId, weekStart: week.start, weekEnd: week.end, data })
  }

  async own(userId: number, id: number): Promise<Report> {
    const report = await this.reports.findById(id)
    if (!report || report.userId !== userId) throw new NotFoundException()
    return report
  }

  async saveDraft(userId: number, id: number, input: unknown): Promise<Report> {
    const report = await this.own(userId, id)
    if (report.status !== 'DRAFT') throw new ConflictException('Отчёт уже отправлен')
    const parsed = reportDataSchema.safeParse(input)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues)
    await this.reports.updateDraft(id, parsed.data)
    return this.own(userId, id)
  }

  async submit(userId: number, id: number): Promise<Report> {
    const report = await this.own(userId, id)
    if (report.status !== 'DRAFT') throw new ConflictException('Отчёт уже отправлен')
    await this.reports.submit(id, await this.reports.planFor(userId))
    const submitted = await this.own(userId, id)
    await this.onSubmitted(submitted)
    return submitted
  }

  list(userId: number): Promise<Report[]> {
    return this.reports.listFor(userId)
  }
}
