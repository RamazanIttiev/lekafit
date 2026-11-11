import type { INestApplication } from '@nestjs/common'
import { sign } from '@tma.js/init-data-node'
import postgres from 'postgres'
import request from 'supertest'
import { type AppConfig, type AppOverrides, createApp } from '../src/app'

export const BOT_TOKEN = '123456:TEST-TOKEN'
export const COACH_ID = 1000

export const testConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  databaseUrl: process.env.DATABASE_URL ?? '',
  botToken: BOT_TOKEN,
  coachTelegramId: COACH_ID,
  webAppUrl: 'https://example.test',
  startBot: false,
  now: () => new Date(2026, 10, 13, 12),
  ...overrides,
})

export type TelegramUser = { id: number; first_name: string; last_name?: string; username?: string }

export const aClient = (overrides: Partial<TelegramUser> = {}): TelegramUser => ({
  id: 2000 + Math.floor(Math.random() * 1_000_000),
  first_name: 'Анна',
  last_name: 'Иванова',
  username: 'anna',
  ...overrides,
})

export const theCoach = (): TelegramUser => ({ id: COACH_ID, first_name: 'Лека' })

export const initDataFor = (
  user: TelegramUser,
  options: { authDate?: Date; token?: string } = {},
) => sign({ user }, options.token ?? BOT_TOKEN, options.authDate ?? new Date())

export const resetDatabase = async () => {
  const sql = postgres(testConfig().databaseUrl, { onnotice: () => {} })
  await sql`truncate users, plans, reports restart identity cascade`.catch(() => undefined)
  await sql.end()
}

export const startApp = async (
  overrides: Partial<AppConfig> = {},
  dependencies: AppOverrides = {},
) => {
  const app = await createApp(testConfig(overrides), {
    telegram: { send: async () => {} },
    ...dependencies,
  })
  await app.init()
  return app
}

export const as = (app: INestApplication, user: TelegramUser) => {
  const auth = `tma ${initDataFor(user)}`
  const server = app.getHttpServer()
  return {
    get: (url: string) => request(server).get(url).set('Authorization', auth),
    post: (url: string, body?: object) =>
      request(server)
        .post(url)
        .set('Authorization', auth)
        .send(body ?? {}),
    patch: (url: string, body: object) =>
      request(server).patch(url).set('Authorization', auth).send(body),
    put: (url: string, body: object) =>
      request(server).put(url).set('Authorization', auth).send(body),
  }
}

export const seedPlan = async (telegramId: number, plan: Record<string, number | null>) => {
  const sql = postgres(testConfig().databaseUrl, { onnotice: () => {} })
  const [user] = await sql<{ id: number }[]>`select id from users where telegram_id = ${telegramId}`
  await sql`insert into plans ${sql({ user_id: user?.id, ...plan })}
    on conflict (user_id) do update set cal = excluded.cal`
  await sql.end()
}
