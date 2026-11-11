import { z } from 'zod'

export const CONFIG = Symbol('CONFIG')

export type AppConfig = {
  databaseUrl: string
  botToken: string
  coachTelegramId: number
  webAppUrl: string
  startBot: boolean
  now: () => Date
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BOT_TOKEN: z.string().min(10),
  COACH_TELEGRAM_ID: z.coerce.number().int().positive(),
  WEBAPP_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
})

export const configFromEnv = (env: NodeJS.ProcessEnv) => {
  const parsed = envSchema.parse(env)
  return {
    port: parsed.PORT,
    config: {
      databaseUrl: parsed.DATABASE_URL,
      botToken: parsed.BOT_TOKEN,
      coachTelegramId: parsed.COACH_TELEGRAM_ID,
      webAppUrl: parsed.WEBAPP_URL,
      startBot: true,
      now: () => new Date(),
    } satisfies AppConfig,
  }
}
