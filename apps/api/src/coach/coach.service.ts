import { planSchema } from '@lekafit/shared'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ReportsRepository } from '../reports/reports.repository'
import { type User, UsersRepository } from '../users/users.repository'

@Injectable()
export class CoachService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
  ) {}

  clients() {
    return this.users.listClients()
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
