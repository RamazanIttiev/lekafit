import { Inject, Injectable, Logger } from '@nestjs/common'
import type { User } from '../auth/users'
import { type AppConfig, CONFIG } from '../config'
import { SQL, type Sql } from '../db'
import type { Report } from '../reports/reports.repository'
import { reportSummary } from './report-summary'
import { TELEGRAM, type TelegramGateway } from './telegram.gateway'

@Injectable()
export class CoachNotifier {
  private readonly logger = new Logger('CoachNotifier')

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(SQL) private readonly sql: Sql,
    @Inject(TELEGRAM) private readonly telegram: TelegramGateway,
  ) {}

  async reportSubmitted(report: Report): Promise<void> {
    try {
      const [client] = await this.sql<User[]>`
        select id, telegram_id::float8 as telegram_id, first_name, last_name, username, role
        from users where id = ${report.userId}`
      if (!client) return
      await this.telegram.send({
        chatId: this.config.coachTelegramId,
        text: reportSummary(report, client),
        webAppButton: {
          text: 'Открыть отчёт',
          url: `${this.config.webAppUrl}/#/coach/reports/${report.id}`,
        },
      })
    } catch (error) {
      this.logger.error(`Coach notification failed for report ${report.id}: ${String(error)}`)
    }
  }
}
