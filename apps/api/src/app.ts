import 'reflect-metadata'
import { type INestApplication, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { CoachGuard, TelegramAuthGuard } from './auth/telegram-auth.guard'
import { Users } from './auth/users'
import { GrammyGateway } from './bot/bot'
import { CoachNotifier } from './bot/coach-notifier'
import { TELEGRAM, type TelegramGateway } from './bot/telegram.gateway'
import { CoachController } from './coach/coach.controller'
import { type AppConfig, CONFIG } from './config'
import { connect, migrate, SQL, type Sql } from './db'
import { MeController } from './me.controller'
import { ReportsController } from './reports/reports.controller'
import { type Report, ReportsRepository } from './reports/reports.repository'
import { REPORT_SUBMITTED, ReportsService } from './reports/reports.service'

export type { AppConfig }

export type AppOverrides = { telegram?: TelegramGateway }

class SqlLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: Sql) {}
  async onApplicationShutdown() {
    await this.sql.end()
  }
}

export const createApp = async (
  config: AppConfig,
  overrides: AppOverrides = {},
): Promise<INestApplication> => {
  const sql = connect(config.databaseUrl)
  await migrate(sql)

  @Module({
    controllers: [MeController, ReportsController, CoachController],
    providers: [
      { provide: CONFIG, useValue: config },
      { provide: SQL, useValue: sql },
      SqlLifecycle,
      Users,
      TelegramAuthGuard,
      CoachGuard,
      ReportsRepository,
      ReportsService,
      CoachNotifier,
      overrides.telegram
        ? { provide: TELEGRAM, useValue: overrides.telegram }
        : { provide: TELEGRAM, useClass: GrammyGateway },
      {
        provide: REPORT_SUBMITTED,
        inject: [CoachNotifier],
        useFactory: (notifier: CoachNotifier) => (report: Report) =>
          notifier.reportSubmitted(report),
      },
    ],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })
  app.enableShutdownHooks()
  return app
}
