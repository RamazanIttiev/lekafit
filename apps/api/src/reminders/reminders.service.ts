import { calendarMonth, monthOfWeek, previousCalendarMonth, weekRange } from '@lekafit/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { clientName } from '../bot/report-summary'
import { type ReportTab, reportTabUrl } from '../bot/report-tab-url'
import { TELEGRAM, type TelegramGateway } from '../bot/telegram.gateway'
import { type AppConfig, CONFIG } from '../config'
import { moscowClock, moscowToday } from '../reports/moscow'
import { ReportsRepository, type SubmittedSummary } from '../reports/reports.repository'
import { type User, UsersRepository } from '../users/users.repository'

const SUNDAY = 0
const EVENING_HOUR = 21
const MORNING_HOUR = 8

const TAB_BUTTONS: Record<ReportTab, string> = {
  week: '📋 Недельный отчёт',
  month: '📅 Месячный отчёт',
}

const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

type MonthlyCycle = { client: User; opensOn: string }

const sentWeeklyIn = (summaries: SubmittedSummary[], userId: number, month: string) =>
  summaries.some(
    (s) => s.userId === userId && s.kind === 'WEEKLY' && monthOfWeek(s.periodStart) === month,
  )

const sentMonthlyFor = (summaries: SubmittedSummary[], userId: number, monthStart: string) =>
  summaries.some((s) => s.userId === userId && s.kind === 'MONTHLY' && s.periodStart === monthStart)

@Injectable()
export class RemindersService {
  private readonly logger = new Logger('RemindersService')
  private readonly fired = new Set<string>()

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(TELEGRAM) private readonly telegram: TelegramGateway,
  ) {}

  async tick(): Promise<void> {
    const now = this.config.now()
    const clock = moscowClock(now)
    if (clock.minute !== 0) return
    const slot = `${clock.date}T${clock.hour}`
    if (this.fired.has(slot)) return
    if (clock.hour === EVENING_HOUR) {
      this.fired.add(slot)
      await this.evening(now, clock)
    }
    if (clock.hour === MORNING_HOUR) {
      this.fired.add(slot)
      await this.morning(clock.date)
    }
  }

  private async evening(now: Date, clock: ReturnType<typeof moscowClock>): Promise<void> {
    const [clients, summaries] = await Promise.all([
      this.users.listClients(),
      this.reports.submittedSummaries(),
    ])
    const weekStart = weekRange(moscowToday(now)).start
    const messages = clients.flatMap((client) => {
      const weekly =
        clock.weekday === SUNDAY &&
        !summaries.some(
          (s) => s.userId === client.id && s.kind === 'WEEKLY' && s.periodStart === weekStart,
        )
          ? [
              {
                tab: 'week' as const,
                text: 'Сегодня последний день недели — не забудьте отправить недельный отчёт.',
              },
            ]
          : []
      const month = calendarMonth(clock.date)
      const monthly =
        month.end === clock.date && sentWeeklyIn(summaries, client.id, month.start.slice(0, 7))
          ? [
              {
                tab: 'month' as const,
                text: 'Завтра откроется месячный отчёт — подготовьте замеры и фото.',
              },
            ]
          : []
      return [...weekly, ...monthly].map((reminder) => ({ client, ...reminder }))
    })
    await Promise.all(messages.map(({ client, tab, text }) => this.remind(client, { tab, text })))
  }

  private async morning(today: string): Promise<void> {
    const [clients, summaries] = await Promise.all([
      this.users.listClients(),
      this.reports.submittedSummaries(),
    ])
    const month = previousCalendarMonth(today)
    const opensOn = calendarMonth(today).start
    const overdue = clients.flatMap((client): MonthlyCycle[] =>
      sentWeeklyIn(summaries, client.id, month.start.slice(0, 7)) &&
      !sentMonthlyFor(summaries, client.id, month.start)
        ? [{ client, opensOn }]
        : [],
    )
    await Promise.all(
      overdue.map(({ client }) =>
        this.remind(client, {
          tab: 'month',
          text: 'Ваш месячный отчёт уже открыт — пора его отправить.',
        }),
      ),
    )
    await this.digest(overdue)
  }

  private async remind(client: User, reminder: { tab: ReportTab; text: string }): Promise<void> {
    try {
      await this.telegram.send({
        chatId: client.telegramId,
        text: reminder.text,
        webAppButton: {
          text: TAB_BUTTONS[reminder.tab],
          url: reportTabUrl(this.config.webAppUrl, reminder.tab),
        },
      })
    } catch (error) {
      this.logger.error(`Reminder failed for client ${client.id}: ${String(error)}`)
    }
  }

  private async digest(overdue: MonthlyCycle[]): Promise<void> {
    if (overdue.length === 0) return
    const lines = overdue.map(
      ({ client, opensOn }) => `• ${clientName(client)} — с ${shortDate(opensOn)}`,
    )
    const text = ['Не отправили месячный отчёт:', ...lines].join('\n')
    await Promise.all(
      this.config.coachTelegramIds.map(async (chatId) => {
        try {
          await this.telegram.send({ chatId, text })
        } catch (error) {
          this.logger.error(`Coach digest failed for ${chatId}: ${String(error)}`)
        }
      }),
    )
  }
}
