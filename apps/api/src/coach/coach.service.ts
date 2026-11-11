import { planSchema } from '@lekafit/shared'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { TELEGRAM, type TelegramGateway } from '../bot/telegram.gateway'
import { ReportsRepository, type SubmittedSummary } from '../reports/reports.repository'
import { type User, UsersRepository } from '../users/users.repository'

export type ClientSummary = User & { lastReportWeek: string | null; unseenReports: number }

const latestIsoDate = (dates: string[]): string | null => dates.toSorted().at(-1) ?? null

const latestTime = (dates: (Date | null)[]): number | null => {
  const times = dates.flatMap((d) => (d ? [d.getTime()] : []))
  return times.length ? Math.max(...times) : null
}

const summarize = (client: User, reports: SubmittedSummary[]) => ({
  summary: {
    ...client,
    lastReportWeek: latestIsoDate(reports.map((r) => r.weekStart)),
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
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(TELEGRAM) private readonly telegram: TelegramGateway,
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

  async setPlan(id: number, input: unknown) {
    await this.client(id)
    const parsed = planSchema.safeParse(input)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues)
    return this.reports.savePlan(id, parsed.data)
  }

  async clientReports(id: number) {
    await this.client(id)
    const all = await this.reports.listFor(id)
    return all.filter((r) => r.status === 'SUBMITTED')
  }

  async report(id: number) {
    const report = await this.reports.findById(id)
    if (report?.status !== 'SUBMITTED') throw new NotFoundException()
    await this.reports.markSeen(id)
    return { ...report, client: await this.client(report.userId) }
  }
}
