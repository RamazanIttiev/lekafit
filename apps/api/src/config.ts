import { z } from 'zod'

export const CONFIG = Symbol('CONFIG')

export type AppConfig = {
  databaseUrl: string
  botToken: string
  coachTelegramIds: number[]
  webAppUrl: string
  startBot: boolean
  now: () => Date
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BOT_TOKEN: z.string().min(10),
  COACH_TELEGRAM_IDS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '')
        .map(Number),
    )
    .pipe(z.array(z.number().int().positive()).min(1)),
  WEBAPP_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
  START_BOT: z.enum(['true', 'false']).default('true'),
  NOW_OVERRIDE: z.coerce.date().optional(),
})

export const configFromEnv = (env: NodeJS.ProcessEnv, clock: () => number = Date.now) => {
  const parsed = envSchema.parse(env)
  const shiftMs = parsed.NOW_OVERRIDE ? parsed.NOW_OVERRIDE.getTime() - clock() : 0
  return {
    port: parsed.PORT,
    config: {
      databaseUrl: parsed.DATABASE_URL,
      botToken: parsed.BOT_TOKEN,
      coachTelegramIds: parsed.COACH_TELEGRAM_IDS,
      webAppUrl: parsed.WEBAPP_URL,
      startBot: parsed.START_BOT === 'true',
      now: () => new Date(clock() + shiftMs),
    } satisfies AppConfig,
  }
}
