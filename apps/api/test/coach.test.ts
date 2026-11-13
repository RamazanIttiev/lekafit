import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { aClient, as, resetDatabase, startApp, type TelegramUser, theCoach } from './support'

let secondsPassed = 0
const app = await startApp({ now: () => new Date(2026, 10, 13, 12, 0, secondsPassed++) })
afterAll(() => app.close())
beforeEach(resetDatabase)

const coach = () => as(app, theCoach())
const plan = {
  cal: 1800,
  protein: 120,
  fat: 60,
  carb: 180,
  steps: 10000,
  training: 3,
  trainingMonth: 12,
  cardioMonth: 300,
}

const registered = async (user: TelegramUser) => {
  const { body } = await as(app, user).get('/me')
  return body.id as number
}

const submitReport = async (user: TelegramUser, data: object = {}) => {
  const { body } = await as(app, user).get('/reports/current')
  await as(app, user).patch(`/reports/${body.id}`, { data })
  await as(app, user).post(`/reports/${body.id}/submit`).expect(200)
  return body.id as number
}

describe('coach-only access', () => {
  it.each([
    '/coach/clients',
    '/coach/clients/1',
    '/coach/clients/1/reports',
    '/coach/reports/1',
    '/coach/invite',
  ])('forbids clients from %s', async (url) => {
    await as(app, aClient()).get(url).expect(403)
  })

  it('forbids clients from changing plans', async () => {
    const client = aClient()
    const id = await registered(client)
    await as(app, client).put(`/coach/clients/${id}/plan`, plan).expect(403)
  })
})

describe('GET /coach/clients', () => {
  it('lists clients with their latest report, unreviewed ones first', async () => {
    const reviewed = aClient({ first_name: 'Вера' })
    const fresh = aClient({ first_name: 'Ольга' })
    const idle = aClient({ first_name: 'Ира' })
    const reviewedReport = await submitReport(reviewed)
    await coach().get(`/coach/reports/${reviewedReport}`)
    await submitReport(fresh)
    await registered(idle)
    await registered(theCoach())

    const res = await coach().get('/coach/clients').expect(200)
    expect(res.body.map((c: { firstName: string }) => c.firstName)).toEqual([
      'Ольга',
      'Вера',
      'Ира',
    ])
    expect(res.body[0]).toMatchObject({ unseenReports: 1, lastReportWeek: '2026-11-09' })
    expect(res.body[1]).toMatchObject({ unseenReports: 0, lastReportWeek: '2026-11-09' })
    expect(res.body[2]).toMatchObject({ unseenReports: 0, lastReportWeek: null })
  })
})

describe('GET /coach/clients ordering', () => {
  const names = (body: { firstName: string }[]) => body.map((c) => c.firstName)

  it('puts an older unreviewed report above a newer reviewed one', async () => {
    const waiting = aClient({ first_name: 'Ждёт' })
    const done = aClient({ first_name: 'Готово' })
    await submitReport(waiting)
    const doneReport = await submitReport(done)
    await coach().get(`/coach/reports/${doneReport}`)
    expect(names((await coach().get('/coach/clients')).body)).toEqual(['Ждёт', 'Готово'])
  })

  it('orders reviewed clients by most recent submission', async () => {
    const earlier = aClient({ first_name: 'Аня' })
    const later = aClient({ first_name: 'Боря' })
    const first = await submitReport(earlier)
    const second = await submitReport(later)
    await coach().get(`/coach/reports/${first}`)
    await coach().get(`/coach/reports/${second}`)
    expect(names((await coach().get('/coach/clients')).body)).toEqual(['Боря', 'Аня'])
  })

  it('lists clients without reports alphabetically, after those with reports', async () => {
    await registered(aClient({ first_name: 'Яна' }))
    await registered(aClient({ first_name: 'Алла' }))
    const reported = aClient({ first_name: 'Вера' })
    await coach().get(`/coach/reports/${await submitReport(reported)}`)
    expect(names((await coach().get('/coach/clients')).body)).toEqual(['Вера', 'Алла', 'Яна'])
  })

  it('shows the latest week and counts every unreviewed report', async () => {
    const client = aClient()
    await submitReport(client)
    const later = await startApp({ now: () => new Date(2026, 10, 19, 9) })
    const { body } = await as(later, client).get('/reports/current')
    await as(later, client).post(`/reports/${body.id}/submit`).expect(200)
    await later.close()
    const [summary] = (await coach().get('/coach/clients')).body
    expect(summary).toMatchObject({ lastReportWeek: '2026-11-16', unseenReports: 2 })
  })
})

describe('client plan', () => {
  it('lets the coach set a plan that the client then sees', async () => {
    const client = aClient()
    const id = await registered(client)
    await coach().put(`/coach/clients/${id}/plan`, plan).expect(200)
    const res = await as(app, client).get('/reports/current')
    expect(res.body.plan).toEqual(plan)
  })

  it('shows the client profile with the current plan', async () => {
    const client = aClient({ first_name: 'Анна' })
    const id = await registered(client)
    await coach().put(`/coach/clients/${id}/plan`, { ...plan, training: null })
    const res = await coach().get(`/coach/clients/${id}`).expect(200)
    expect(res.body).toMatchObject({ id, firstName: 'Анна', plan: { ...plan, training: null } })
  })

  it('accepts a plan without monthly targets, leaving them unset', async () => {
    const client = aClient()
    const id = await registered(client)
    const { trainingMonth: _, cardioMonth: __, ...weeklyOnly } = plan
    await coach().put(`/coach/clients/${id}/plan`, weeklyOnly).expect(200)
    const res = await coach().get(`/coach/clients/${id}`)
    expect(res.body.plan).toEqual({ ...weeklyOnly, trainingMonth: null, cardioMonth: null })
  })

  it('rejects invalid plans', async () => {
    const id = await registered(aClient())
    await coach()
      .put(`/coach/clients/${id}/plan`, { ...plan, cal: -5 })
      .expect(400)
  })

  it('returns 404 for unknown clients', async () => {
    await coach().get('/coach/clients/999').expect(404)
    await coach().put('/coach/clients/999/plan', plan).expect(404)
  })
})

describe('client report history', () => {
  it('shows only submitted reports, newest first', async () => {
    const client = aClient()
    const id = await registered(client)
    await submitReport(client, { now: { weight: '70' } })
    const later = await startApp({ now: () => new Date(2026, 10, 19, 9) })
    await as(later, client).get('/reports/current')
    await later.close()

    const res = await coach().get(`/coach/clients/${id}/reports`).expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({
      periodStart: '2026-11-09',
      data: { now: { weight: '70' } },
    })
  })

  it('opens a single report with the client name and marks it as reviewed', async () => {
    const client = aClient({ first_name: 'Анна' })
    const reportId = await submitReport(client)
    const res = await coach().get(`/coach/reports/${reportId}`).expect(200)
    expect(res.body).toMatchObject({ id: reportId, client: { firstName: 'Анна' } })
    const list = await coach().get('/coach/clients')
    expect(list.body[0].unseenReports).toBe(0)
  })

  it('does not show drafts to the coach', async () => {
    const { body } = await as(app, aClient()).get('/reports/current')
    await coach().get(`/coach/reports/${body.id}`).expect(404)
  })
})

describe('GET /coach/invite', () => {
  it('gives the coach a link to the bot that clients can open to join', async () => {
    const res = await coach().get('/coach/invite').expect(200)
    expect(res.body).toEqual({ url: 'https://t.me/lekafit_test_bot' })
  })
})
