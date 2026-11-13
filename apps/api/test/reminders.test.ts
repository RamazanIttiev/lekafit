import { beforeEach, describe, expect, it } from 'vitest'
import type { SentMessage } from '../src/bot/telegram.gateway'
import { RemindersService } from '../src/reminders/reminders.service'
import {
  aClient,
  as,
  COACH_ID,
  resetDatabase,
  seedSubmittedReport,
  startApp,
  type TelegramUser,
} from './support'

const sent: SentMessage[] = []
let failFor: number | null = null
const telegram = {
  send: async (message: SentMessage) => {
    if (message.chatId === failFor) throw new Error('blocked')
    sent.push(message)
  },
  botUsername: async () => 'bot',
}

const moscow = (iso: string) => new Date(`${iso}+03:00`)

const tickAt = async (iso: string) => {
  const app = await startApp({ now: () => moscow(iso) }, { telegram })
  await app.get(RemindersService).tick()
  await app.close()
}

const registered = async (overrides: Partial<TelegramUser> = {}) => {
  const client = aClient(overrides)
  const setup = await startApp({}, { telegram })
  await as(setup, client).get('/me')
  await setup.close()
  return client
}

const submittedMonthlyOn = (client: TelegramUser, day: string) =>
  seedSubmittedReport(client.id, {
    kind: 'MONTHLY',
    periodStart: day,
    periodEnd: day,
    submittedAt: moscow(`${day}T12:00:00`),
  })

const submittedWeek = (client: TelegramUser, start: string, end: string) =>
  seedSubmittedReport(client.id, {
    kind: 'WEEKLY',
    periodStart: start,
    periodEnd: end,
    submittedAt: moscow(`${start}T12:00:00`),
  })

const toClient = (client: TelegramUser) => sent.filter((m) => m.chatId === client.id)
const toCoach = () => sent.filter((m) => m.chatId === COACH_ID)

beforeEach(async () => {
  sent.length = 0
  failFor = null
  await resetDatabase()
})

describe('weekly reminder', () => {
  it('reminds a client who has not submitted at 21:00 on Sunday, Moscow time', async () => {
    const client = await registered()
    await tickAt('2026-11-15T21:00:00')
    expect(toClient(client)).toHaveLength(1)
    expect(toClient(client)[0]?.text).toContain('недельный отчёт')
    expect(toClient(client)[0]?.webAppButton).toEqual({
      text: '📋 Недельный отчёт',
      url: 'https://example.test/?tab=week',
    })
  })

  it('does not remind a client who already submitted this week', async () => {
    const client = await registered()
    await submittedWeek(client, '2026-11-09', '2026-11-15')
    await tickAt('2026-11-15T21:00:00')
    expect(toClient(client)).toEqual([])
  })

  it('still reminds a client who only submitted an earlier week', async () => {
    const client = await registered()
    await submittedWeek(client, '2026-11-02', '2026-11-08')
    await tickAt('2026-11-15T21:00:00')
    expect(toClient(client)).toHaveLength(1)
  })

  it("is not silenced by another client's weekly report or by a monthly report", async () => {
    const client = await registered()
    const other = await registered()
    await submittedWeek(other, '2026-11-09', '2026-11-15')
    await seedSubmittedReport(client.id, {
      kind: 'MONTHLY',
      periodStart: '2026-11-09',
      periodEnd: '2026-11-15',
      submittedAt: moscow('2026-11-10T12:00:00'),
    })
    await tickAt('2026-11-15T21:00:00')
    expect(toClient(client)).toHaveLength(1)
  })

  it('stays quiet on other days, other hours and other minutes', async () => {
    await registered()
    await tickAt('2026-11-14T21:00:00')
    await tickAt('2026-11-15T20:59:00')
    await tickAt('2026-11-15T22:00:00')
    await tickAt('2026-11-15T08:00:00')
    await tickAt('2026-11-15T21:30:00')
    await tickAt('2026-11-15T08:30:00')
    expect(sent).toEqual([])
  })

  it('does not message the coach and does not follow up on Monday', async () => {
    await registered()
    await tickAt('2026-11-15T21:00:00')
    await tickAt('2026-11-16T08:00:00')
    expect(toCoach()).toEqual([])
    expect(sent).toHaveLength(1)
  })

  it('does not remind the coach', async () => {
    await registered()
    await tickAt('2026-11-15T21:00:00')
    expect(sent.map((m) => m.chatId)).not.toContain(COACH_ID)
  })

  it('sends once even if the clock ticks several times within the minute', async () => {
    const client = await registered()
    const app = await startApp({ now: () => moscow('2026-11-15T21:00:20') }, { telegram })
    await app.get(RemindersService).tick()
    await app.get(RemindersService).tick()
    await app.close()
    expect(toClient(client)).toHaveLength(1)
  })

  it('keeps sending on later days and hours from the same running process', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    let current = moscow('2026-11-13T08:00:00')
    const app = await startApp({ now: () => current }, { telegram })
    await app.get(RemindersService).tick()
    current = moscow('2026-11-14T08:00:00')
    await app.get(RemindersService).tick()
    current = moscow('2026-11-15T21:00:00')
    await app.get(RemindersService).tick()
    await app.close()
    expect(toClient(client)).toHaveLength(3)
  })

  it('keeps reminding the others when one client blocked the bot', async () => {
    const blocked = await registered()
    const reachable = await registered()
    failFor = blocked.id
    await tickAt('2026-11-15T21:00:00')
    expect(toClient(reachable)).toHaveLength(1)
  })
})

describe('monthly reminder', () => {
  it('announces the next monthly report at 21:00 on its last closed day', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    await tickAt('2026-11-12T21:00:00')
    expect(toClient(client)).toHaveLength(1)
    expect(toClient(client)[0]?.text).toContain('Завтра откроется месячный отчёт')
    expect(toClient(client)[0]?.webAppButton).toEqual({
      text: '📅 Месячный отчёт',
      url: 'https://example.test/?tab=month',
    })
  })

  it('clamps the opening day to the end of a shorter month', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-01-31')
    await tickAt('2026-02-27T21:00:00')
    expect(toClient(client)).toHaveLength(1)
  })

  it('does not announce on other days or to clients without a monthly report', async () => {
    const client = await registered()
    const newcomer = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    await tickAt('2026-11-11T21:00:00')
    await tickAt('2026-11-13T21:00:00')
    expect(toClient(client)).toEqual([])
    expect(toClient(newcomer)).toEqual([])
  })

  it('follows up at 08:00 every day once the report is open, until submitted', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    await tickAt('2026-11-13T08:00:00')
    await tickAt('2026-11-14T08:00:00')
    await tickAt('2026-11-20T08:00:00')
    expect(toClient(client)).toHaveLength(3)
    expect(toClient(client)[0]?.text).toContain('месячный отчёт уже открыт')
    expect(toClient(client)[0]?.webAppButton?.url).toBe('https://example.test/?tab=month')
  })

  it('does not follow up before the report opens or after it is submitted', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    await tickAt('2026-11-12T08:00:00')
    expect(toClient(client)).toEqual([])
    await submittedMonthlyOn(client, '2026-11-14')
    await tickAt('2026-11-15T08:00:00')
    expect(toClient(client)).toEqual([])
  })

  it('sends the coach a digest of clients who missed the monthly report', async () => {
    const anna = await registered({ first_name: 'Анна', last_name: 'Иванова', username: 'anna' })
    const olga = await registered({
      first_name: 'Ольга',
      last_name: undefined,
      username: undefined,
    })
    const done = await registered({ first_name: 'Мария' })
    await submittedMonthlyOn(anna, '2026-10-13')
    await submittedMonthlyOn(olga, '2026-10-10')
    await submittedMonthlyOn(done, '2026-10-01')
    await submittedMonthlyOn(done, '2026-11-12')
    await tickAt('2026-11-14T08:00:00')
    expect(toCoach()).toHaveLength(1)
    const text = toCoach()[0]?.text ?? ''
    expect(text).toContain('Не отправили месячный отчёт')
    expect(text).toContain('Не отправили месячный отчёт:\n')
    expect(text).toContain('Анна Иванова (@anna) — с 13.11')
    expect(text).toContain('Ольга — с 10.11')
    expect(text).not.toContain('Мария')
  })

  it('anchors on the latest monthly submission and ignores weekly reports', async () => {
    const client = await registered()
    const weeklyOnly = await registered()
    await submittedMonthlyOn(client, '2026-11-12')
    await submittedMonthlyOn(client, '2026-10-13')
    await submittedWeek(weeklyOnly, '2026-10-12', '2026-10-18')
    await tickAt('2026-11-14T08:00:00')
    expect(toClient(client)).toEqual([])
    expect(toClient(weeklyOnly)).toEqual([])
  })

  it("does not count another client's monthly report", async () => {
    const client = await registered()
    const other = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    await submittedMonthlyOn(other, '2026-11-12')
    await tickAt('2026-11-14T08:00:00')
    expect(toClient(client)).toHaveLength(1)
  })

  it('still reminds clients when the coach digest cannot be delivered', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    failFor = COACH_ID
    await tickAt('2026-11-14T08:00:00')
    expect(toClient(client)).toHaveLength(1)
  })

  it('sends no digest when nobody missed the report', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-11-12')
    await tickAt('2026-11-14T08:00:00')
    expect(toCoach()).toEqual([])
  })

  it('still sends the digest when a client blocked the bot', async () => {
    const client = await registered()
    await submittedMonthlyOn(client, '2026-10-13')
    failFor = client.id
    await tickAt('2026-11-14T08:00:00')
    expect(toCoach()).toHaveLength(1)
  })
})
