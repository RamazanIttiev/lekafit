import 'reflect-metadata'
import { type INestApplication, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CoachGuard, TelegramAuthGuard } from './auth/telegram-auth.guard'
import { GrammyGateway } from './bot/bot'
import { CoachNotifier } from './bot/coach-notifier'
import { TELEGRAM, type TelegramGateway } from './bot/telegram.gateway'
import { CoachController } from './coach/coach.controller'
import { CoachService } from './coach/coach.service'
import { type AppConfig, CONFIG } from './config'
import { dataSourceOptions, entities } from './data-source'
import { MeController } from './me.controller'
import { ReportsController } from './reports/reports.controller'
import { type Report, ReportsRepository } from './reports/reports.repository'
import { REPORT_SUBMITTED, ReportsService } from './reports/reports.service'
import { UsersRepository } from './users/users.repository'
import { UsersService } from './users/users.service'

export type { AppConfig }

export type AppOverrides = { telegram?: TelegramGateway }

export const createApp = async (
  config: AppConfig,
  overrides: AppOverrides = {},
): Promise<INestApplication> => {
  @Module({
    imports: [
      TypeOrmModule.forRoot(dataSourceOptions(config.databaseUrl)),
      TypeOrmModule.forFeature(entities),
    ],
    controllers: [MeController, ReportsController, CoachController],
    providers: [
      { provide: CONFIG, useValue: config },
      UsersRepository,
      UsersService,
      TelegramAuthGuard,
      CoachGuard,
      ReportsRepository,
      ReportsService,
      CoachService,
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
