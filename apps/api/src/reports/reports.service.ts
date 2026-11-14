import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  MEASURES,
  PHOTO_ANGLES,
  type MonthlyReportData,
  monthlyReportDataSchema,
  previousCalendarMonth,
  type ReportData,
  type ReportKind,
  reportDataSchema,
  weekRange,
} from '@lekafit/shared'
import { type AppConfig, CONFIG } from '../config'
import { computedMonthly } from './monthly-summary'
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

const monthlyPrefill = (previous: Report | null): MonthlyReportData =>
  monthlyReportDataSchema.parse(previous?.kind === 'MONTHLY' ? { about: previous.data.about } : {})

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
  const { about, wellbeing, feedback } = parsed.data
  return { ...report.data, about, wellbeing, feedback }
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
    const period = previousCalendarMonth(moscowIsoDate(this.config.now()))
    const existing = await this.reports.findForPeriod({
      userId,
      kind: 'MONTHLY',
      periodStart: period.start,
    })
    if (existing) return existing
    const previous = await this.reports.lastSubmittedBefore({
      userId,
      kind: 'MONTHLY',
      periodStart: period.start,
    })
    return this.reports.create({
      userId,
      kind: 'MONTHLY',
      periodStart: period.start,
      periodEnd: period.end,
      data: monthlyPrefill(previous),
    })
  }

  private async withComputedValues(report: MonthlyReport): Promise<MonthlyReportData> {
    const [weeklies, previous] = await Promise.all([
      this.reports.listFor(report.userId, 'WEEKLY'),
      this.reports.lastSubmittedBefore({
        userId: report.userId,
        kind: 'MONTHLY',
        periodStart: report.periodStart,
      }),
    ])
    const computed = computedMonthly({
      weeklies: weeklies.flatMap((w) => (w.kind === 'WEEKLY' ? [w] : [])),
      month: report.periodStart.slice(0, 7),
      previousMonth: previousCalendarMonth(report.periodStart).start.slice(0, 7),
      keptBaseline: previous?.kind === 'MONTHLY' ? previous.data.baseline : {},
    })
    return { ...report.data, ...computed }
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
    if (report.kind === 'MONTHLY') {
      requireAllPhotos(report.photos)
      await this.reports.updateDraft(id, await this.withComputedValues(report))
    }
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
