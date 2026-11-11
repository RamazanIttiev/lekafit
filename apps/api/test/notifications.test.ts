import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { SentMessage } from '../src/bot/telegram.gateway'
import { aClient, as, COACH_ID, resetDatabase, seedPlan, startApp } from './support'

const sent: SentMessage[] = []
const app = await startApp({}, { telegram: { send: async (m) => void sent.push(m) } })
const lastWeekApp = await startApp({ now: () => new Date(2026, 10, 6, 12) })
afterAll(async () => {
  await app.close()
  await lastWeekApp.close()
})
beforeEach(async () => {
  sent.length = 0
  await resetDatabase()
})

const submitFilledReport = async () => {
  const client = aClient({ first_name: 'Анна', last_name: 'Иванова', username: 'anna' })
  await as(app, client).get('/me')
  await seedPlan(client.id, {
    cal: 1800,
    protein: 120,
    fat: 60,
    carb: 180,
    steps: 10000,
    training: 3,
  })
  const lastWeek = await as(lastWeekApp, client).get('/reports/current')
  await as(lastWeekApp, client).patch(`/reports/${lastWeek.body.id}`, {
    data: { now: { weight: '72,4' } },
  })
  await as(lastWeekApp, client).post(`/reports/${lastWeek.body.id}/submit`).expect(200)
  const { body } = await as(app, client).get('/reports/current')
  await as(app, client).patch(`/reports/${body.id}`, {
    data: {
      fact: { cal: '1850', protein: '115', steps: '9000', training: '3' },
      now: { weight: '71,9', waist: '70' },
    },
  })
  await as(app, client).post(`/reports/${body.id}/submit`).expect(200)
  return body.id as number
}

describe('coach notification on submit', () => {
  it('messages the coach with a summary of the report', async () => {
    await submitFilledReport()
    expect(sent).toHaveLength(1)
    expect(sent[0]?.chatId).toBe(COACH_ID)
    const text = sent[0]?.text ?? ''
    expect(text).toContain('Новый отчёт: Анна Иванова (@anna)')
    expect(text).toContain('Неделя 09.11 — 15.11')
    expect(text).toContain('Калории: 1850 / 1 800 (+50)')
    expect(text).toContain('Белки: 115 / 120 (-5)')
    expect(text).toContain('Шаги: 9000 / 10 000 (90%)')
    expect(text).toContain('Тренировки: 3 / 3 (100%)')
    expect(text).toContain('Вес: 72,4 → 71,9 (-0,5)')
    expect(text).not.toContain('Жиры')
    expect(text).not.toContain('Талия')
  })

  it('adds a button that opens the report in the coach view', async () => {
    const id = await submitFilledReport()
    expect(sent[0]?.webAppButton).toEqual({
      text: 'Открыть отчёт',
      url: `https://example.test/#/coach/reports/${id}`,
    })
  })

  it('still submits the report if Telegram is unreachable', async () => {
    const failing = await startApp(
      {},
      { telegram: { send: async () => Promise.reject(new Error('network')) } },
    )
    const client = aClient()
    const { body } = await as(failing, client).get('/reports/current')
    await as(failing, client).post(`/reports/${body.id}/submit`).expect(200)
    await failing.close()
  })
})
