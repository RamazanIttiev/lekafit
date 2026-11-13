import { describe, expect, it } from 'vitest'
import { configFromEnv } from './config'

const baseEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5433/db',
  BOT_TOKEN: '123456:TEST-TOKEN',
  COACH_TELEGRAM_IDS: '1',
  WEBAPP_URL: 'https://example.test',
}

describe('configFromEnv now', () => {
  it('uses the real clock by default', () => {
    const before = Date.now()
    const now = configFromEnv(baseEnv).config.now().getTime()
    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(Date.now())
  })

  it('starts the clock at NOW_OVERRIDE and keeps it ticking', () => {
    let realTime = Date.parse('2026-11-13T10:00:00Z')
    const { config } = configFromEnv(
      { ...baseEnv, NOW_OVERRIDE: '2026-12-09T09:00:00+03:00' },
      () => realTime,
    )
    expect(config.now().toISOString()).toBe('2026-12-09T06:00:00.000Z')
    realTime += 90_000
    expect(config.now().toISOString()).toBe('2026-12-09T06:01:30.000Z')
  })

  it('rejects an unparsable NOW_OVERRIDE', () => {
    expect(() => configFromEnv({ ...baseEnv, NOW_OVERRIDE: 'tomorrow' })).toThrow()
  })
})
