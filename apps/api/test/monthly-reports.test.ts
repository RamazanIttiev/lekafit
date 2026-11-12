import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { aClient, as, resetDatabase, startApp, type TelegramUser, theCoach } from './support'

const appAt = (date: Date) => startApp({ now: () => date })
const app = await appAt(new Date(2026, 10, 12, 9))
afterAll(() => app.close())
beforeEach(resetDatabase)

const MONTHLY = '/reports/current?kind=monthly'

const submitMonth = async (
  date: Date,
  client: TelegramUser,
  data: object,
): Promise<{ id: number }> => {
  const monthApp = await appAt(date)
  const draft = await as(monthApp, client).get(MONTHLY).expect(200)
  await as(monthApp, client).patch(`/reports/${draft.body.id}`, { data }).expect(200)
  await as(monthApp, client).post(`/reports/${draft.body.id}/submit`).expect(200)
  await monthApp.close()
  return draft.body
}

const nextMonthDraft = async (client: TelegramUser) => {
  const decemberApp = await appAt(new Date(2026, 11, 10, 9))
  const res = await as(decemberApp, client).get(MONTHLY).expect(200)
  await decemberApp.close()
  return res.body
}

describe('GET /reports/current?kind=monthly', () => {
  it('opens an empty monthly draft for the current month', async () => {
    const res = await as(app, aClient()).get(MONTHLY).expect(200)
    expect(res.body).toMatchObject({
      kind: 'MONTHLY',
      weekStart: '2026-11-01',
      weekEnd: '2026-11-30',
      submittedAt: null,
    })
    expect(res.body.data.fact.cardio).toBe('')
    expect(res.body.data.baseline.thigh).toBe('')
  })

  it('opens the previous month during the first three days of a month', async () => {
    const earlyApp = await appAt(new Date(2026, 11, 3, 9))
    const res = await as(earlyApp, aClient()).get(MONTHLY).expect(200)
    await earlyApp.close()
    expect(res.body.weekStart).toBe('2026-11-01')
  })

  it('is a separate report from the weekly one', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current').expect(200)
    const monthly = await as(app, client).get(MONTHLY).expect(200)
    expect(weekly.body.kind).toBe('WEEKLY')
    expect(weekly.body.data).not.toHaveProperty('baseline')
    expect(monthly.body.id).not.toBe(weekly.body.id)
  })

  it('does not reuse a weekly report that starts on the first of the month', async () => {
    const client = aClient()
    const mondayFirstApp = await appAt(new Date(2027, 10, 4, 9))
    const weekly = await as(mondayFirstApp, client).get('/reports/current').expect(200)
    const monthly = await as(mondayFirstApp, client).get(MONTHLY).expect(200)
    await mondayFirstApp.close()
    expect(weekly.body.weekStart).toBe('2027-11-01')
    expect(monthly.body.weekStart).toBe('2027-11-01')
    expect(monthly.body.id).not.toBe(weekly.body.id)
  })

  it('carries last month into "previous", the start values and the goal forward', async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 20, 9), client, {
      about: { startDate: '2026-10-01', goal: 'Рекомпозиция тела' },
      baseline: { weight: '75', thigh: '58' },
      now: { weight: '72', thigh: '56' },
    })
    const december = await nextMonthDraft(client)
    expect(december.data.prev).toMatchObject({ weight: '72', thigh: '56' })
    expect(december.data.baseline).toMatchObject({ weight: '75', thigh: '58' })
    expect(december.data.about).toEqual({ startDate: '2026-10-01', goal: 'Рекомпозиция тела' })
  })

  it("uses the first month's measurements as the start when no start values were entered", async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 20, 9), client, { now: { weight: '72' } })
    const december = await nextMonthDraft(client)
    expect(december.data.baseline.weight).toBe('72')
  })

  it('ignores weekly reports when prefilling', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    await as(app, client).patch(`/reports/${weekly.body.id}`, { data: { now: { weight: '70' } } })
    await as(app, client).post(`/reports/${weekly.body.id}/submit`)
    const december = await nextMonthDraft(client)
    expect(december.data.prev.weight).toBe('')
  })

  it('rejects an unknown kind', async () => {
    await as(app, aClient()).get('/reports/current?kind=yearly').expect(400)
  })
})

describe('PATCH a monthly report', () => {
  it('saves monthly-only fields', async () => {
    const client = aClient()
    const draft = await as(app, client).get(MONTHLY)
    const res = await as(app, client)
      .patch(`/reports/${draft.body.id}`, {
        data: { fact: { cardio: '240' }, wellbeing: { planEase: 'В целом получалось' } },
      })
      .expect(200)
    expect(res.body.data.fact.cardio).toBe('240')
    expect(res.body.data.wellbeing.planEase).toBe('В целом получалось')
  })

  it('lets the client enter start values in the first month', async () => {
    const client = aClient()
    const draft = await as(app, client).get(MONTHLY)
    const res = await as(app, client)
      .patch(`/reports/${draft.body.id}`, { data: { baseline: { weight: '75' } } })
      .expect(200)
    expect(res.body.data.baseline.weight).toBe('75')
  })

  it('keeps carried-forward previous and start values, ignoring client edits', async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 20, 9), client, {
      baseline: { weight: '75' },
      now: { weight: '72' },
    })
    const decemberApp = await appAt(new Date(2026, 11, 10, 9))
    const draft = await as(decemberApp, client).get(MONTHLY)
    const res = await as(decemberApp, client)
      .patch(`/reports/${draft.body.id}`, {
        data: { prev: { weight: '1' }, baseline: { weight: '2' } },
      })
      .expect(200)
    await decemberApp.close()
    expect(res.body.data.prev.weight).toBe('72')
    expect(res.body.data.baseline.weight).toBe('75')
  })

  it('validates against the monthly schema', async () => {
    const client = aClient()
    const draft = await as(app, client).get(MONTHLY)
    await as(app, client)
      .patch(`/reports/${draft.body.id}`, { data: { about: { goal: 'Нет такой цели' } } })
      .expect(400)
  })
})

describe('listing', () => {
  it('lists monthly reports separately from weekly ones', async () => {
    const client = aClient()
    await as(app, client).get('/reports/current')
    const monthly = await as(app, client).get(MONTHLY)
    const weeklyList = await as(app, client).get('/reports').expect(200)
    const monthlyList = await as(app, client).get('/reports?kind=monthly').expect(200)
    expect(weeklyList.body.map((r: { kind: string }) => r.kind)).toEqual(['WEEKLY'])
    expect(monthlyList.body.map((r: { id: number }) => r.id)).toEqual([monthly.body.id])
  })
})

describe('monthly reports for the coach', () => {
  it('lists submitted monthly reports in the client history with their kind', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${weekly.body.id}/submit`).expect(200)
    const monthly = await submitMonth(new Date(2026, 10, 20, 9), client, {})
    const clients = await as(app, theCoach()).get('/coach/clients').expect(200)
    const reports = await as(app, theCoach())
      .get(`/coach/clients/${clients.body[0].id}/reports`)
      .expect(200)
    expect(reports.body.map((r: { id: number; kind: string }) => [r.id, r.kind])).toEqual(
      expect.arrayContaining([
        [weekly.body.id, 'WEEKLY'],
        [monthly.id, 'MONTHLY'],
      ]),
    )
  })

  it('counts unreviewed monthly reports and opens them', async () => {
    const client = aClient()
    const monthly = await submitMonth(new Date(2026, 10, 20, 9), client, {
      fact: { cardio: '240' },
    })
    const before = await as(app, theCoach()).get('/coach/clients')
    expect(before.body[0].unseenReports).toBe(1)
    const res = await as(app, theCoach()).get(`/coach/reports/${monthly.id}`).expect(200)
    expect(res.body).toMatchObject({ kind: 'MONTHLY', data: { fact: { cardio: '240' } } })
    const after = await as(app, theCoach()).get('/coach/clients')
    expect(after.body[0].unseenReports).toBe(0)
  })

  it('keeps "last report" pointing at the latest weekly report', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${weekly.body.id}/submit`).expect(200)
    await submitMonth(new Date(2026, 11, 10, 9), client, {})
    const clients = await as(app, theCoach()).get('/coach/clients')
    expect(clients.body[0].lastReportWeek).toBe('2026-11-09')
  })

  it('shows the coach monthly workout and cardio targets in the monthly report', async () => {
    const client = aClient()
    const { body: me } = await as(app, client).get('/me')
    await as(app, theCoach())
      .put(`/coach/clients/${me.id}/plan`, {
        cal: 1800,
        protein: 120,
        fat: 60,
        carb: 180,
        steps: 10000,
        training: 3,
        trainingMonth: 12,
        cardioMonth: 300,
      })
      .expect(200)
    const res = await as(app, client).get(MONTHLY)
    expect(res.body.plan).toMatchObject({ trainingMonth: 12, cardioMonth: 300 })
  })
})
