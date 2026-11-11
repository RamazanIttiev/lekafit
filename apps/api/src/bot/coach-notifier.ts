import { Inject, Injectable, Logger } from '@nestjs/common'
import { type AppConfig, CONFIG } from '../config'
import type { Report } from '../reports/reports.repository'
import { UsersRepository } from '../users/users.repository'
import { reportSummary } from './report-summary'
import { TELEGRAM, type TelegramGateway } from './telegram.gateway'

@Injectable()
export class CoachNotifier {
  private readonly logger = new Logger('CoachNotifier')

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(TELEGRAM) private readonly telegram: TelegramGateway,
  ) {}

  async reportSubmitted(report: Report): Promise<void> {
    try {
      const client = await this.users.findById(report.userId)
      if (!client) return
      await this.telegram.send({
        chatId: this.config.coachTelegramId,
        text: reportSummary(report, client),
        webAppButton: {
          text: 'Открыть отчёт',
          url: `${this.config.webAppUrl}/?report=${report.id}`,
        },
      })
    } catch (error) {
      this.logger.error(`Coach notification failed for report ${report.id}: ${String(error)}`)
    }
  }
}
