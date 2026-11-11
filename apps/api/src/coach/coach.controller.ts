import { planSchema } from '@lekafit/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common'
import { CoachGuard, TelegramAuthGuard } from '../auth/telegram-auth.guard'
import { SQL, type Sql } from '../db'
import { ReportsRepository } from '../reports/reports.repository'

type ClientRow = {
  id: number
  telegramId: number
  firstName: string
  lastName: string | null
  username: string | null
}

type ClientListRow = ClientRow & { lastReportWeek: string | null; unseenReports: number }

@Controller('coach')
@UseGuards(TelegramAuthGuard, CoachGuard)
export class CoachController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
  ) {}

  @Get('clients')
  clients() {
    return this.sql<ClientListRow[]>`
      select u.id, u.telegram_id::float8 as telegram_id, u.first_name, u.last_name, u.username,
        to_char(max(r.week_start), 'YYYY-MM-DD') as last_report_week,
        count(r.id) filter (where r.seen_by_coach_at is null)::int as unseen_reports
      from users u
      left join reports r on r.user_id = u.id and r.status = 'SUBMITTED'
      where u.role = 'CLIENT'
      group by u.id
      order by count(r.id) filter (where r.seen_by_coach_at is null) > 0 desc, max(r.submitted_at) desc nulls last, u.first_name`
  }

  private async client(id: number): Promise<ClientRow> {
    const [row] = await this.sql<ClientRow[]>`
      select id, telegram_id::float8 as telegram_id, first_name, last_name, username
      from users where id = ${id} and role = 'CLIENT'`
    if (!row) throw new NotFoundException()
    return row
  }

  @Get('clients/:id')
  async clientProfile(@Param('id', ParseIntPipe) id: number) {
    const client = await this.client(id)
    return { ...client, plan: await this.reports.planFor(id) }
  }

  @Put('clients/:id/plan')
  async setPlan(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    await this.client(id)
    const parsed = planSchema.safeParse(body)
    if (!parsed.success) throw new BadRequestException(parsed.error.issues)
    return this.reports.savePlan(id, parsed.data)
  }

  @Get('clients/:id/reports')
  async clientReports(@Param('id', ParseIntPipe) id: number) {
    await this.client(id)
    const all = await this.reports.listFor(id)
    return all.filter((r) => r.status === 'SUBMITTED')
  }

  @Get('reports/:id')
  async report(@Param('id', ParseIntPipe) id: number) {
    const report = await this.reports.findById(id)
    if (report?.status !== 'SUBMITTED') throw new NotFoundException()
    await this.reports.markSeen(id)
    return { ...report, client: await this.client(report.userId) }
  }
}
