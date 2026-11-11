import 'reflect-metadata'
import { type INestApplication, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { TelegramAuthGuard } from './auth/telegram-auth.guard'
import { Users } from './auth/users'
import { type AppConfig, CONFIG } from './config'
import { connect, migrate, SQL, type Sql } from './db'
import { MeController } from './me.controller'

export type { AppConfig }

class SqlLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: Sql) {}
  async onApplicationShutdown() {
    await this.sql.end()
  }
}

export const createApp = async (config: AppConfig): Promise<INestApplication> => {
  const sql = connect(config.databaseUrl)
  await migrate(sql)

  @Module({
    controllers: [MeController],
    providers: [
      { provide: CONFIG, useValue: config },
      { provide: SQL, useValue: sql },
      SqlLifecycle,
      Users,
      TelegramAuthGuard,
    ],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })
  app.enableShutdownHooks()
  return app
}
