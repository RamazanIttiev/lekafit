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
  PHOTO_ANGLES,
  type MonthlyReportData,
  monthlyReportDataSchema,
  monthlyDueDate,
  type ReportData,
  type ReportKind,
  reportDataSchema,
  weekRange,
} from '@lekafit/shared'
import { type AppConfig, CONFIG } from '../config'
import { moscowIsoDate, moscowToday } from './moscow'
import { type MonthlyReport, type Report, ReportsRepository } from './reports.repository'

export const REPORT_SUBMITTED = Symbol('REPORT_SUBMITTED')
export type ReportSubmittedListener = (report: Report) => Promise<void>

const WEEKS: Record<string, number> = { current: 0, previous: -7 }

const weeklyPeriod = (now: Date, weekQuery: string | undefined) => {
  const offsetDays = WEEKS[weekQuery ?? 'current']
  if (offsetDays === undefined) throw new BadRequestException('Unknown week')
  const today = moscowToday(now)
  return weekRange(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays))
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

const requireAllPhotos = (photos: MonthlyReport['photos']) => {
  const missing = PHOTO_ANGLES.filter((a) => !photos[a.key]).map((a) => a.label)
  if (missing.length) throw new BadRequestException(`Добавьте фото: ${missing.join(', ')}`)
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(REPORT_SUBMITTED) private readonly onSubmitted: ReportSubmittedListener,
  ) {}

  async current(userId: number, kindQuery?: string, weekQuery?: string): Promise<Report> {
    const kind = parseKind(kindQuery)
    return kind === 'WEEKLY' ? this.currentWeekly(userId, weekQuery) : this.currentMonthly(userId)
  }

  private async currentWeekly(userId: number, weekQuery?: string): Promise<Report> {
    const period = weeklyPeriod(this.config.now(), weekQuery)
    const existing = await this.reports.findForPeriod({
      userId,
      kind: 'WEEKLY',
      periodStart: period.start,
    })
    if (existing) return existing
    const previous = await this.reports.lastSubmittedBefore({
      userId,
      kind: 'WEEKLY',
      periodStart: period.start,
    })
    return this.reports.create({
      userId,
      kind: 'WEEKLY',
      periodStart: period.start,
      periodEnd: period.end,
      data: weeklyPrefill(previous),
    })
  }

  private async currentMonthly(userId: number): Promise<Report> {
    const today = moscowIsoDate(this.config.now())
    const last = await this.reports.lastSubmitted(userId, 'MONTHLY')
    const period = last?.submittedAt
      ? this.cycleAfter(moscowIsoDate(last.submittedAt), today)
      : { start: today, end: today }
    const open = await this.reports.openDraft(userId, 'MONTHLY')
    if (open) return open
    return this.reports.create({
      userId,
      kind: 'MONTHLY',
      periodStart: period.start,
      periodEnd: period.end,
      data: monthlyPrefill(last, await this.reports.firstSubmitted(userId, 'MONTHLY')),
    })
  }

  private cycleAfter(submittedOn: string, today: string) {
    const due = monthlyDueDate(submittedOn)
    if (today < due)
      throw new ConflictException(
        `Следующий месячный отчёт откроется ${due.slice(8, 10)}.${due.slice(5, 7)}`,
      )
    return { start: submittedOn, end: due }
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
    if (report.kind === 'MONTHLY') requireAllPhotos(report.photos)
    await this.reports.submit({
      id,
      plan: await this.reports.planFor(userId),
      at: this.config.now(),
    })
    const submitted = await this.own(userId, id)
    await this.onSubmitted(submitted)
    return submitted
  }

  list(userId: number, kindQuery?: string): Promise<Report[]> {
    return this.reports.listFor(userId, parseKind(kindQuery))
  }
}
