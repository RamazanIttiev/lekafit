import { planSchema } from '@lekafit/shared'
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { TELEGRAM, type TelegramGateway } from '../bot/telegram.gateway'
import { type AppConfig, CONFIG } from '../config'
import { ReportsRepository, type SubmittedSummary } from '../reports/reports.repository'
import { type User, UsersRepository } from '../users/users.repository'

export type ClientSummary = User & {
  lastReportWeek: string | null
  hasMonthlyReport: boolean
  unseenReports: number
}

const latestIsoDate = (dates: string[]): string | null => dates.toSorted().at(-1) ?? null

const latestTime = (dates: (Date | null)[]): number | null => {
  const times = dates.flatMap((d) => (d ? [d.getTime()] : []))
  return times.length ? Math.max(...times) : null
}

const summarize = (client: User, reports: SubmittedSummary[]) => ({
  summary: {
    ...client,
    lastReportWeek: latestIsoDate(
      reports.filter((r) => r.kind === 'WEEKLY').map((r) => r.weekStart),
    ),
    hasMonthlyReport: reports.some((r) => r.kind === 'MONTHLY'),
    unseenReports: reports.filter((r) => r.seenByCoachAt === null).length,
  },
  lastSubmittedAt: latestTime(reports.map((r) => r.submittedAt)),
})

type Summarized = ReturnType<typeof summarize>

const byReviewPriority = (a: Summarized, b: Summarized) =>
  Number(b.summary.unseenReports > 0) - Number(a.summary.unseenReports > 0) ||
  (b.lastSubmittedAt ?? -1) - (a.lastSubmittedAt ?? -1) ||
  a.summary.firstName.localeCompare(b.summary.firstName, 'ru')

@Injectable()
export class CoachService {
  private readonly logger = new Logger('CoachService')

  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(TELEGRAM) private readonly telegram: TelegramGateway,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async invite(): Promise<{ url: string }> {
    return { url: `https://t.me/${await this.telegram.botUsername()}` }
  }

  async clients(): Promise<ClientSummary[]> {
    const [clients, reports] = await Promise.all([
      this.users.listClients(),
      this.reports.submittedSummaries(),
    ])
    return clients
      .map((client) =>
        summarize(
          client,
          reports.filter((r) => r.userId === client.id),
        ),
      )
      .sort(byReviewPriority)
      .map(({ summary }) => summary)
  }

  private async client(id: number): Promise<User> {
    const client = await this.users.findClient(id)
    if (!client) throw new NotFoundException()
    return client
  }

  async clientProfile(id: number) {
    const client = await this.client(id)
    return { ...client, plan: await this.reports.planFor(id) }
  }

  async setPlan(id: number, input: unknown, notify = false) {
    const client = await this.client(id)
    const parsed = planSchema.safeParse(input)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues)
    const saved = await this.reports.savePlan(id, parsed.data)
    if (notify) await this.notifyPlanChanged(client)
    return saved
  }

  private async notifyPlanChanged(client: User): Promise<void> {
    try {
      await this.telegram.send({
        chatId: client.telegramId,
        text: 'Тренер обновил ваш план. Откройте приложение, чтобы посмотреть.',
        webAppButton: { text: 'Открыть план', url: this.config.webAppUrl },
      })
    } catch (error) {
      this.logger.error(`Plan notification failed for client ${client.id}: ${String(error)}`)
    }
  }

  async clientReports(id: number) {
    await this.client(id)
    return this.reports.submittedFor(id)
  }

  async report(id: number) {
    const report = await this.reports.findById(id)
    if (!report?.submittedAt) throw new NotFoundException()
    await this.reports.markSeen(id)
    return { ...report, client: await this.client(report.userId) }
  }
}
