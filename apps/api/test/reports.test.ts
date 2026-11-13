import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { aClient, as, resetDatabase, seedPlan, startApp } from './support'

const thursday = () => new Date(2026, 10, 12, 9)
const app = await startApp({ now: thursday })
const mondayApp = await startApp({ now: () => new Date(2026, 10, 16, 9) })
afterAll(async () => {
  await app.close()
  await mondayApp.close()
})
beforeEach(resetDatabase)

describe('weekly period in Moscow time', () => {
  it('moves to the new week on Thursday Moscow time, even while it is still Wednesday in UTC', async () => {
    const wednesdayNightUtc = await startApp({ now: () => new Date(Date.UTC(2026, 10, 18, 22, 0)) })
    const res = await as(wednesdayNightUtc, aClient()).get('/reports/current').expect(200)
    await wednesdayNightUtc.close()
    expect(res.body.weekStart).toBe('2026-11-16')
  })
})

const filledFacts = {
  fact: { cal: '1850', protein: '120', fat: '60', carb: '180', steps: '9000', training: '3' },
  now: { weight: '71,9', waist: '70' },
}

describe('GET /reports/current', () => {
  it('opens an empty draft for the current week from Thursday onwards', async () => {
    const res = await as(app, aClient()).get('/reports/current').expect(200)
    expect(res.body).toMatchObject({
      weekStart: '2026-11-09',
      weekEnd: '2026-11-15',
      submittedAt: null,
      plan: null,
    })
    expect(res.body.data.fact.cal).toBe('')
  })

  it('opens the new week on Monday', async () => {
    const res = await as(mondayApp, aClient()).get('/reports/current').expect(200)
    expect(res.body.weekStart).toBe('2026-11-16')
  })

  it('opens the same week on its Sunday', async () => {
    const sundayApp = await startApp({ now: () => new Date(Date.UTC(2026, 10, 15, 12)) })
    const res = await as(sundayApp, aClient()).get('/reports/current').expect(200)
    await sundayApp.close()
    expect(res.body).toMatchObject({ weekStart: '2026-11-09', weekEnd: '2026-11-15' })
  })

  it('does not let the client send last week report in the new week', async () => {
    const client = aClient()
    const lastWeek = await as(app, client).get('/reports/current')
    const thisWeek = await as(mondayApp, client).get('/reports/current')
    expect(thisWeek.body.id).not.toBe(lastWeek.body.id)
    expect(thisWeek.body.weekStart).toBe('2026-11-16')
  })

  it('returns the same draft on every visit', async () => {
    const client = aClient()
    const first = await as(app, client).get('/reports/current')
    const second = await as(app, client).get('/reports/current')
    expect(second.body.id).toBe(first.body.id)
  })

  it('returns one draft when the app is opened twice at the same moment', async () => {
    const client = aClient()
    await as(app, client).get('/me')
    const [a, b] = await Promise.all([
      as(app, client).get('/reports/current').expect(200),
      as(app, client).get('/reports/current').expect(200),
    ])
    expect(a.body.id).toBe(b.body.id)
  })

  it('prefills from the most recent sent report when there are several', async () => {
    const client = aClient()
    const week1 = await as(app, client).get('/reports/current')
    await as(app, client).patch(`/reports/${week1.body.id}`, { data: { now: { weight: '72' } } })
    await as(app, client).post(`/reports/${week1.body.id}/submit`)
    const nextWeekApp = await startApp({ now: () => new Date(2026, 10, 19, 9) })
    const week2 = await as(nextWeekApp, client).get('/reports/current')
    await as(nextWeekApp, client).patch(`/reports/${week2.body.id}`, {
      data: { now: { weight: '71' } },
    })
    await as(nextWeekApp, client).post(`/reports/${week2.body.id}/submit`)
    await nextWeekApp.close()
    const weekAfterApp = await startApp({ now: () => new Date(2026, 10, 26, 9) })
    const week3 = await as(weekAfterApp, client).get('/reports/current')
    await weekAfterApp.close()
    expect(week3.body.data.prev.weight).toBe('71')
  })

  it('includes the plan the coach set', async () => {
    const client = aClient()
    await as(app, client).get('/me')
    await seedPlan(client.id, {
      cal: 1800,
      protein: 120,
      fat: 60,
      carb: 180,
      steps: 10000,
      training: 3,
    })
    const res = await as(app, client).get('/reports/current')
    expect(res.body.plan).toEqual({
      cal: 1800,
      protein: 120,
      fat: 60,
      carb: 180,
      steps: 10000,
      training: 3,
      trainingMonth: null,
      cardioMonth: null,
    })
  })

  it('prefills "before" measurements from the last submitted report', async () => {
    const client = aClient()
    const lastWeek = await as(app, client).get('/reports/current')
    await as(app, client).patch(`/reports/${lastWeek.body.id}`, { data: filledFacts })
    await as(app, client).post(`/reports/${lastWeek.body.id}/submit`).expect(200)

    const sundayApp = await startApp({ now: () => new Date(Date.UTC(2026, 10, 15, 12)) })
    const sameWeek = await as(sundayApp, client).get('/reports/current')
    await sundayApp.close()
    expect(sameWeek.body).toMatchObject({ weekStart: '2026-11-09' })
    expect(sameWeek.body.submittedAt).toBeTruthy()

    const later = await startApp({ now: () => new Date(2026, 10, 19, 9) })
    const fresh = await as(later, client).get('/reports/current')
    await later.close()
    expect(fresh.body.weekStart).toBe('2026-11-16')
    expect(fresh.body.data.prev).toMatchObject({ weight: '71,9', waist: '70', chest: '' })
    expect(fresh.body.data.now.weight).toBe('')
  })
})

describe('PATCH /reports/:id', () => {
  it('saves the draft so it survives closing the app', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client).patch(`/reports/${body.id}`, { data: filledFacts }).expect(200)
    const reopened = await as(app, client).get('/reports/current')
    expect(reopened.body.data.fact.cal).toBe('1850')
    expect(reopened.body.data.now.weight).toBe('71,9')
  })

  it('lets the client fill an empty "before" measurement', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client)
      .patch(`/reports/${body.id}`, { data: { ...filledFacts, prev: { weight: '99' } } })
      .expect(200)
    const reopened = await as(app, client).get('/reports/current')
    expect(reopened.body.data.prev.weight).toBe('99')
  })

  it('keeps a saved "before" measurement, ignoring client edits', async () => {
    const client = aClient()
    const first = await as(app, client).get('/reports/current')
    await as(app, client)
      .patch(`/reports/${first.body.id}`, { data: { ...filledFacts, prev: { weight: '99' } } })
      .expect(200)
    await as(app, client)
      .patch(`/reports/${first.body.id}`, { data: { ...filledFacts, prev: { weight: '1' } } })
      .expect(200)
    const reopened = await as(app, client).get('/reports/current')
    expect(reopened.body.data.prev.weight).toBe('99')
  })

  it('rejects invalid data', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client)
      .patch(`/reports/${body.id}`, { data: { wellbeing: { sleep: 'всегда' } } })
      .expect(400)
  })

  it("does not let a client touch someone else's report", async () => {
    const { body } = await as(app, aClient()).get('/reports/current')
    await as(app, aClient()).patch(`/reports/${body.id}`, { data: filledFacts }).expect(404)
  })

  it('refuses changes after the report is submitted', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${body.id}/submit`).expect(200)
    const res = await as(app, client)
      .patch(`/reports/${body.id}`, { data: filledFacts })
      .expect(409)
    expect(res.body.message).toBe('Отчёт уже отправлен')
  })
})

describe('POST /reports/:id/submit', () => {
  it('locks the report and records when it was sent', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    const res = await as(app, client).post(`/reports/${body.id}/submit`).expect(200)
    expect(res.body.submittedAt).toBeTruthy()
  })

  it('keeps the plan as it was at submission time', async () => {
    const client = aClient()
    await as(app, client).get('/me')
    await seedPlan(client.id, {
      cal: 1800,
      protein: 120,
      fat: 60,
      carb: 180,
      steps: 10000,
      training: 3,
    })
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${body.id}/submit`)
    await seedPlan(client.id, {
      cal: 1600,
      protein: 120,
      fat: 60,
      carb: 180,
      steps: 10000,
      training: 3,
    })
    const res = await as(app, client).get(`/reports/${body.id}`)
    expect(res.body.plan.cal).toBe(1800)
  })

  it('cannot be submitted twice', async () => {
    const client = aClient()
    const { body } = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${body.id}/submit`).expect(200)
    const res = await as(app, client).post(`/reports/${body.id}/submit`).expect(409)
    expect(res.body.message).toBe('Отчёт уже отправлен')
  })
})

describe('GET /reports', () => {
  it("lists only the client's own reports, newest week first", async () => {
    const client = aClient()
    const older = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${older.body.id}/submit`)
    const later = await startApp({ now: () => new Date(2026, 10, 19, 9) })
    await as(later, client).get('/reports/current')
    await later.close()
    await as(app, aClient()).get('/reports/current')

    const res = await as(app, client).get('/reports').expect(200)
    expect(res.body.map((r: { weekStart: string }) => r.weekStart)).toEqual([
      '2026-11-16',
      '2026-11-09',
    ])
  })
})
