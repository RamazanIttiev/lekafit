import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  MEASURES,
  MONTHLY_MEASURES,
  type MonthlyReportData,
  monthlyReportDataSchema,
  monthRange,
  type ReportData,
  type ReportKind,
  reportDataSchema,
  weekRange,
} from '@lekafit/shared'
import { type AppConfig, CONFIG } from '../config'
import { type MonthlyReport, type Report, ReportsRepository } from './reports.repository'

export const REPORT_SUBMITTED = Symbol('REPORT_SUBMITTED')
export type ReportSubmittedListener = (report: Report) => Promise<void>

const GRACE_DAYS = 3

const daysBefore = (now: Date, days: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

const PERIODS: Record<ReportKind, (now: Date) => { start: string; end: string }> = {
  WEEKLY: (now) => weekRange(daysBefore(now, GRACE_DAYS)),
  MONTHLY: (now) => monthRange(daysBefore(now, GRACE_DAYS)),
}

const KINDS_BY_QUERY: Record<string, ReportKind> = { weekly: 'WEEKLY', monthly: 'MONTHLY' }

const parseKind = (query: string | undefined): ReportKind => {
  const kind = KINDS_BY_QUERY[query ?? 'weekly']
  if (!kind) throw new BadRequestException('Unknown report kind')
  return kind
}

const weeklyPrefill = (previous: Report | null): ReportData => {
  const empty = reportDataSchema.parse({})
  if (previous?.kind !== 'WEEKLY') return empty
  const prev = Object.fromEntries(MEASURES.map((m) => [m.key, previous.data.now[m.key]]))
  return reportDataSchema.parse({ ...empty, prev })
}

const startValues = (first: MonthlyReport) =>
  Object.fromEntries(
    MONTHLY_MEASURES.map((m) => [m.key, first.data.baseline[m.key] || first.data.now[m.key]]),
  )

const monthlyPrefill = (
  previous: Report | null,
  first: Report | null,
): MonthlyReportData => {
  if (previous?.kind !== 'MONTHLY' || first?.kind !== 'MONTHLY')
    return monthlyReportDataSchema.parse({})
  return monthlyReportDataSchema.parse({
    about: previous.data.about,
    plan: previous.data.plan,
    prev: Object.fromEntries(MONTHLY_MEASURES.map((m) => [m.key, previous.data.now[m.key]])),
    baseline: startValues(first),
  })
}

const keepFilled = (stored: Record<string, string>, input: Record<string, string>) =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, stored[key] || value]))

const mergeDraft = (report: Report, input: unknown): ReportData | MonthlyReportData => {
  if (report.kind === 'WEEKLY') {
    const parsed = reportDataSchema.safeParse(input)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues)
    return reportDataSchema.parse({
      ...parsed.data,
      prev: keepFilled(report.data.prev, parsed.data.prev),
    })
  }
  const parsed = monthlyReportDataSchema.safeParse(input)
  if (!parsed.success) throw new BadRequestException(parsed.error.issues)
  return monthlyReportDataSchema.parse({
    ...parsed.data,
    prev: keepFilled(report.data.prev, parsed.data.prev),
    baseline: keepFilled(report.data.baseline, parsed.data.baseline),
  })
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(REPORT_SUBMITTED) private readonly onSubmitted: ReportSubmittedListener,
  ) {}

  async current(userId: number, kindQuery?: string): Promise<Report> {
    const kind = parseKind(kindQuery)
    const period = PERIODS[kind](this.config.now())
    const existing = await this.reports.findForPeriod({ userId, kind, weekStart: period.start })
    if (existing) return existing
    const previous = await this.reports.lastSubmitted(userId, kind)
    const data =
      kind === 'WEEKLY'
        ? weeklyPrefill(previous)
        : monthlyPrefill(previous, await this.reports.firstSubmitted(userId, kind))
    return this.reports.create({
      userId,
      kind,
      weekStart: period.start,
      weekEnd: period.end,
      data,
    })
  }

  async own(userId: number, id: number): Promise<Report> {
    const report = await this.reports.findById(id)
    if (!report || report.userId !== userId) throw new NotFoundException()
    return report
  }

  async saveDraft(userId: number, id: number, input: unknown): Promise<Report> {
    const report = await this.own(userId, id)
    if (report.submittedAt) throw new ConflictException('Отчёт уже отправлен')
    await this.reports.updateDraft(id, mergeDraft(report, input))
    return this.own(userId, id)
  }

  async submit(userId: number, id: number): Promise<Report> {
    const report = await this.own(userId, id)
    if (report.submittedAt) throw new ConflictException('Отчёт уже отправлен')
    await this.reports.submit(id, await this.reports.planFor(userId))
    const submitted = await this.own(userId, id)
    await this.onSubmitted(submitted)
    return submitted
  }

  list(userId: number, kindQuery?: string): Promise<Report[]> {
    return this.reports.listFor(userId, parseKind(kindQuery))
  }
}
