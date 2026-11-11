import { type Plan, type ReportData, reportDataSchema } from '@lekafit/shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, QueryFailedError, type Repository } from 'typeorm'
import { PlanEntity } from './plan.entity'
import { ReportEntity, type ReportStatus } from './report.entity'

export type { ReportStatus }

export type Report = {
  id: number
  userId: number
  weekStart: string
  weekEnd: string
  status: ReportStatus
  data: ReportData
  plan: Plan | null
  submittedAt: Date | null
  seenByCoachAt: Date | null
}

export type SubmittedSummary = Pick<
  ReportEntity,
  'userId' | 'weekStart' | 'submittedAt' | 'seenByCoachAt'
>

const UNIQUE_VIOLATION = '23505'

const isUniqueViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  'code' in error.driverError &&
  error.driverError.code === UNIQUE_VIOLATION

const toPlan = ({ cal, protein, fat, carb, steps, training }: PlanEntity): Plan => ({
  cal,
  protein,
  fat,
  carb,
  steps,
  training,
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
    const { planSnapshot, data, user: _, updatedAt: __, ...rest } = entity
    const plan = rest.status === 'SUBMITTED' ? planSnapshot : await this.planFor(rest.userId)
    return { ...rest, data: reportDataSchema.parse(data), plan }
  }

  async findForWeek(userId: number, weekStart: string): Promise<Report | null> {
    return this.toReport(await this.reports.findOneBy({ userId, weekStart }))
  }

  async findById(id: number): Promise<Report | null> {
    return this.toReport(await this.reports.findOneBy({ id }))
  }

  async lastSubmitted(userId: number): Promise<Report | null> {
    return this.toReport(
      await this.reports.findOne({
        where: { userId, status: 'SUBMITTED' },
        order: { weekStart: 'DESC' },
      }),
    )
  }

  async create(input: {
    userId: number
    weekStart: string
    weekEnd: string
    data: ReportData
  }): Promise<Report> {
    try {
      await this.reports.insert(input)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
    const report = await this.findForWeek(input.userId, input.weekStart)
    if (!report) throw new Error('Report was not created')
    return report
  }

  async updateDraft(id: number, data: ReportData): Promise<void> {
    await this.reports.update({ id, status: 'DRAFT' }, { data })
  }

  async submit(id: number, plan: Plan | null): Promise<void> {
    await this.reports.update(
      { id, status: 'DRAFT' },
      { status: 'SUBMITTED', submittedAt: new Date(), planSnapshot: plan },
    )
  }

  async listFor(userId: number): Promise<Report[]> {
    const entities = await this.reports.find({ where: { userId }, order: { weekStart: 'DESC' } })
    const reports = await Promise.all(entities.map((e) => this.toReport(e)))
    return reports.filter((r): r is Report => r !== null)
  }

  async submittedSummaries(): Promise<SubmittedSummary[]> {
    return this.reports.find({
      select: { userId: true, weekStart: true, submittedAt: true, seenByCoachAt: true },
      where: { status: 'SUBMITTED' },
    })
  }

  async markSeen(id: number): Promise<void> {
    await this.reports.update({ id, seenByCoachAt: IsNull() }, { seenByCoachAt: new Date() })
  }
}
