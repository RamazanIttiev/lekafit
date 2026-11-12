import {
  type MonthlyReportData,
  monthlyReportDataSchema,
  type Plan,
  type ReportData,
  type ReportKind,
  reportDataSchema,
} from '@lekafit/shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Not, QueryFailedError, type Repository } from 'typeorm'
import { PlanEntity } from './plan.entity'
import { ReportEntity } from './report.entity'

type ReportFields = {
  id: number
  userId: number
  weekStart: string
  weekEnd: string
  plan: Plan | null
  submittedAt: Date | null
  seenByCoachAt: Date | null
}

export type WeeklyReport = ReportFields & { kind: 'WEEKLY'; data: ReportData }
export type MonthlyReport = ReportFields & { kind: 'MONTHLY'; data: MonthlyReportData }
export type Report = WeeklyReport | MonthlyReport

export type SubmittedSummary = Pick<
  ReportEntity,
  'userId' | 'kind' | 'weekStart' | 'submittedAt' | 'seenByCoachAt'
>

const UNIQUE_VIOLATION = '23505'

const isUniqueViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  'code' in error.driverError &&
  error.driverError.code === UNIQUE_VIOLATION

const toPlan = ({
  cal,
  protein,
  fat,
  carb,
  steps,
  training,
  trainingMonth,
  cardioMonth,
}: PlanEntity): Plan => ({
  cal,
  protein,
  fat,
  carb,
  steps,
  training,
  trainingMonth,
  cardioMonth,
})

@Injectable()
export class ReportsRepository {
  constructor(
    @InjectRepository(ReportEntity) private readonly reports: Repository<ReportEntity>,
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
  ) {}

  async planFor(userId: number): Promise<Plan | null> {
    const plan = await this.plans.findOneBy({ userId })
    return plan ? toPlan(plan) : null
  }

  async savePlan(userId: number, plan: Plan): Promise<Plan> {
    await this.plans.upsert({ userId, ...plan }, ['userId'])
    return plan
  }

  private async toReport(entity: ReportEntity | null): Promise<Report | null> {
    if (!entity) return null
    const { planSnapshot, data, kind, user: _, updatedAt: __, ...rest } = entity
    const plan = rest.submittedAt ? planSnapshot : await this.planFor(rest.userId)
    return kind === 'MONTHLY'
      ? { ...rest, kind, plan, data: monthlyReportDataSchema.parse(data) }
      : { ...rest, kind, plan, data: reportDataSchema.parse(data) }
  }

  async findForPeriod(input: {
    userId: number
    kind: ReportKind
    weekStart: string
  }): Promise<Report | null> {
    return this.toReport(await this.reports.findOneBy(input))
  }

  async findById(id: number): Promise<Report | null> {
    return this.toReport(await this.reports.findOneBy({ id }))
  }

  private async submittedEdge(
    userId: number,
    kind: ReportKind,
    order: 'ASC' | 'DESC',
  ): Promise<Report | null> {
    return this.toReport(
      await this.reports.findOne({
        where: { userId, kind, submittedAt: Not(IsNull()) },
        order: { weekStart: order },
      }),
    )
  }

  lastSubmitted(userId: number, kind: ReportKind): Promise<Report | null> {
    return this.submittedEdge(userId, kind, 'DESC')
  }

  firstSubmitted(userId: number, kind: ReportKind): Promise<Report | null> {
    return this.submittedEdge(userId, kind, 'ASC')
  }

  async create(input: {
    userId: number
    kind: ReportKind
    weekStart: string
    weekEnd: string
    data: ReportData | MonthlyReportData
  }): Promise<Report> {
    try {
      await this.reports.insert(input)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
    const { userId, kind, weekStart } = input
    const report = await this.findForPeriod({ userId, kind, weekStart })
    if (!report) throw new Error('Report was not created')
    return report
  }

  async updateDraft(id: number, data: ReportData | MonthlyReportData): Promise<void> {
    await this.reports.update({ id, submittedAt: IsNull() }, { data })
  }

  async submit(id: number, plan: Plan | null): Promise<void> {
    await this.reports.update(
      { id, submittedAt: IsNull() },
      { submittedAt: new Date(), planSnapshot: plan },
    )
  }

  async listFor(userId: number, kind: ReportKind): Promise<Report[]> {
    const entities = await this.reports.find({
      where: { userId, kind },
      order: { weekStart: 'DESC' },
    })
    const reports = await Promise.all(entities.map((e) => this.toReport(e)))
    return reports.filter((r): r is Report => r !== null)
  }

  async submittedFor(userId: number): Promise<Report[]> {
    const entities = await this.reports.find({
      where: { userId, submittedAt: Not(IsNull()) },
      order: { weekStart: 'DESC' },
    })
    const reports = await Promise.all(entities.map((e) => this.toReport(e)))
    return reports.filter((r): r is Report => r !== null)
  }

  async submittedSummaries(): Promise<SubmittedSummary[]> {
    return this.reports.find({
      select: { userId: true, kind: true, weekStart: true, submittedAt: true, seenByCoachAt: true },
      where: { submittedAt: Not(IsNull()) },
    })
  }

  async markSeen(id: number): Promise<void> {
    await this.reports.update({ id, seenByCoachAt: IsNull() }, { seenByCoachAt: new Date() })
  }
}
