import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  aClient,
  as,
  resetDatabase,
  seedSubmittedReport,
  startApp,
  type TelegramUser,
  theCoach,
} from './support'

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
  for (const angle of ['front', 'side', 'back']) {
    await as(monthApp, client)
      .upload(`/reports/${draft.body.id}/photos/${angle}`, Buffer.from([0xff, 0xd8]))
      .expect(200)
  }
  await as(monthApp, client).post(`/reports/${draft.body.id}/submit`).expect(200)
  await monthApp.close()
  return draft.body
}

const weekly = async (
  client: TelegramUser,
  weekStart: string,
  data: { fact?: Record<string, string>; now?: Record<string, string> },
  submitted = true,
) => {
  await as(app, client).get('/me').expect(200)
  const monday = new Date(`${weekStart}T00:00:00Z`)
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await seedSubmittedReport(client.id, {
    kind: 'WEEKLY',
    periodStart: weekStart,
    periodEnd: sunday,
    submittedAt: submitted ? new Date(`${sunday}T12:00:00Z`) : null,
    data,
  })
}

const submittedOctober = async (client: TelegramUser) => {
  const res = await submitMonth(new Date(2026, 10, 12, 9), client, {})
  const coachView = await as(app, theCoach()).get(`/coach/reports/${res.id}`).expect(200)
  return coachView.body
}

describe('GET /reports/current?kind=monthly', () => {
  it('opens the previous calendar month', async () => {
    const res = await as(app, aClient()).get(MONTHLY).expect(200)
    expect(res.body).toMatchObject({
      kind: 'MONTHLY',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      submittedAt: null,
    })
  })

  it('returns the same draft on every visit', async () => {
    const client = aClient()
    const first = await as(app, client).get(MONTHLY)
    const second = await as(app, client).get(MONTHLY)
    expect(second.body.id).toBe(first.body.id)
  })

  it('uses the Moscow date, not the UTC one', async () => {
    const lateEveningUtc = await startApp({ now: () => new Date(Date.UTC(2026, 10, 30, 22, 30)) })
    const res = await as(lateEveningUtc, aClient()).get(MONTHLY).expect(200)
    await lateEveningUtc.close()
    expect(res.body).toMatchObject({ periodStart: '2026-11-01', periodEnd: '2026-11-30' })
  })

  it('is a separate report from the weekly one', async () => {
    const client = aClient()
    const weeklyDraft = await as(app, client).get('/reports/current').expect(200)
    const monthly = await as(app, client).get(MONTHLY).expect(200)
    expect(weeklyDraft.body.kind).toBe('WEEKLY')
    expect(weeklyDraft.body.data).not.toHaveProperty('baseline')
    expect(monthly.body.id).not.toBe(weeklyDraft.body.id)
  })

  it('shows the sent report until the next month begins', async () => {
    const client = aClient()
    const sent = await submitMonth(new Date(2026, 10, 3, 9), client, {})
    const res = await as(app, client).get(MONTHLY).expect(200)
    expect(res.body.id).toBe(sent.id)
    expect(res.body.submittedAt).not.toBeNull()
  })

  it('opens the next month on the 1st', async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 3, 9), client, {})
    const firstOfDecember = await appAt(new Date(2026, 11, 1, 9))
    const res = await as(firstOfDecember, client).get(MONTHLY).expect(200)
    await firstOfDecember.close()
    expect(res.body).toMatchObject({
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      submittedAt: null,
    })
  })

  it('carries the goal and start date forward from the previous monthly report', async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 3, 9), client, {
      about: { startDate: '2026-10-01', goal: 'Рекомпозиция тела' },
    })
    const decemberApp = await appAt(new Date(2026, 11, 1, 9))
    const res = await as(decemberApp, client).get(MONTHLY).expect(200)
    await decemberApp.close()
    expect(res.body.data.about).toEqual({ startDate: '2026-10-01', goal: 'Рекомпозиция тела' })
  })

  it('rejects an unknown kind', async () => {
    await as(app, aClient()).get('/reports/current?kind=yearly').expect(400)
  })
})

describe('monthly values computed from weekly reports', () => {
  it('averages nutrition and steps and totals training and cardio over the month', async () => {
    const client = aClient()
    await weekly(client, '2026-10-05', {
      fact: {
        cal: '1800',
        protein: '120',
        fat: '60',
        carb: '200',
        steps: '9000',
        training: '3',
        cardio: '60',
      },
    })
    await weekly(client, '2026-10-12', {
      fact: { cal: '2001', protein: '130', fat: '70', carb: '180', steps: '10000', training: '2' },
    })
    const report = await submittedOctober(client)
    expect(report.data.fact).toMatchObject({
      cal: '1901',
      protein: '125',
      fat: '65',
      carb: '190',
      steps: '9500',
      training: '5',
      cardio: '60',
    })
  })

  it('counts a week crossing months toward the month with most of its days', async () => {
    const client = aClient()
    await weekly(client, '2026-09-21', { fact: { training: '1' } })
    await weekly(client, '2026-09-28', { fact: { training: '2' } })
    await weekly(client, '2026-10-26', { fact: { training: '4' } })
    await weekly(client, '2026-11-02', { fact: { training: '8' } })
    const report = await submittedOctober(client)
    expect(report.data.fact.training).toBe('6')
  })

  it('skips draft weekly reports and blank values', async () => {
    const client = aClient()
    await weekly(client, '2026-10-05', { fact: { cal: '1800' } })
    await weekly(client, '2026-10-12', { fact: { cal: '' } })
    await weekly(client, '2026-10-19', { fact: { cal: '3000' } }, false)
    const report = await submittedOctober(client)
    expect(report.data.fact.cal).toBe('1800')
    expect(report.data.fact.cardio).toBe('')
  })

  it("averages this month's measurements, compares them with last month's and the very first", async () => {
    const client = aClient()
    await weekly(client, '2026-09-07', { now: { weight: '80', thigh: '60' } })
    await weekly(client, '2026-09-14', { now: { weight: '78' } })
    await weekly(client, '2026-10-05', { now: { weight: '76.5', thigh: '58' } })
    await weekly(client, '2026-10-12', { now: { weight: '75.4', thigh: '57' } })
    const report = await submittedOctober(client)
    expect(report.data.now).toMatchObject({ weight: '76', thigh: '57.5' })
    expect(report.data.prev).toMatchObject({ weight: '79', thigh: '60' })
    expect(report.data.baseline).toMatchObject({ weight: '80', thigh: '60' })
  })

  it('takes a start value from the first weekly report that has it', async () => {
    const client = aClient()
    await weekly(client, '2026-10-05', { now: { weight: '76' } })
    await weekly(client, '2026-10-12', { now: { weight: '75', waist: '70' } })
    const report = await submittedOctober(client)
    expect(report.data.baseline).toMatchObject({ weight: '76', waist: '70' })
  })

  it('keeps the start values once recorded, even if an earlier weekly report appears later', async () => {
    const client = aClient()
    await weekly(client, '2026-10-05', { now: { weight: '76' } })
    await submittedOctober(client)
    await weekly(client, '2026-09-07', { now: { weight: '90', waist: '72' } })
    await weekly(client, '2026-11-02', { now: { weight: '74' } })
    const november = await submitMonth(new Date(2026, 11, 1, 9), client, {})
    const res = await as(app, theCoach()).get(`/coach/reports/${november.id}`).expect(200)
    expect(res.body.data.baseline).toMatchObject({ weight: '76', waist: '72' })
  })

  it('can be sent without any weekly reports, leaving computed values blank', async () => {
    const report = await submittedOctober(aClient())
    expect(report.data.fact.cal).toBe('')
    expect(report.data.now.weight).toBe('')
    expect(report.data.baseline.weight).toBe('')
  })

  it("does not change after it is sent when more of that month's weekly reports arrive", async () => {
    const client = aClient()
    await weekly(client, '2026-10-05', { fact: { cal: '1800' } })
    const sent = await submittedOctober(client)
    await weekly(client, '2026-10-12', { fact: { cal: '2200' } })
    const again = await as(app, theCoach()).get(`/coach/reports/${sent.id}`).expect(200)
    expect(again.body.data.fact.cal).toBe('1800')
  })
})

describe('PATCH a monthly report', () => {
  it('saves the goal, wellbeing and month summary', async () => {
    const client = aClient()
    const draft = await as(app, client).get(MONTHLY)
    const res = await as(app, client)
      .patch(`/reports/${draft.body.id}`, {
        data: {
          about: { goal: 'Рекомпозиция тела' },
          wellbeing: { planEase: 'В целом получалось' },
          feedback: { wins: 'Минус 2 кг' },
        },
      })
      .expect(200)
    expect(res.body.data.about.goal).toBe('Рекомпозиция тела')
    expect(res.body.data.wellbeing.planEase).toBe('В целом получалось')
    expect(res.body.data.feedback.wins).toBe('Минус 2 кг')
  })

  it('ignores nutrition, activity and measurements sent by the client', async () => {
    const client = aClient()
    const draft = await as(app, client).get(MONTHLY)
    const res = await as(app, client)
      .patch(`/reports/${draft.body.id}`, {
        data: {
          fact: { cal: '1' },
          now: { weight: '1' },
          prev: { weight: '1' },
          baseline: { weight: '1' },
        },
      })
      .expect(200)
    expect(res.body.data.fact.cal).toBe('')
    expect(res.body.data.now.weight).toBe('')
    expect(res.body.data.prev.weight).toBe('')
    expect(res.body.data.baseline.weight).toBe('')
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
    await weekly(client, '2026-10-05', { fact: { cardio: '240' } })
    const monthly = await submitMonth(new Date(2026, 10, 20, 9), client, {})
    const before = await as(app, theCoach()).get('/coach/clients')
    expect(before.body[0].unseenReports).toBe(2)
    const res = await as(app, theCoach()).get(`/coach/reports/${monthly.id}`).expect(200)
    expect(res.body).toMatchObject({ kind: 'MONTHLY', data: { fact: { cardio: '240' } } })
    const after = await as(app, theCoach()).get('/coach/clients')
    expect(after.body[0].unseenReports).toBe(1)
  })

  it('keeps "last report" pointing at the latest weekly report', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${weekly.body.id}/submit`).expect(200)
    await submitMonth(new Date(2026, 11, 20, 9), client, {})
    const clients = await as(app, theCoach()).get('/coach/clients')
    expect(clients.body[0].lastReportWeek).toBe('2026-11-09')
  })

  it('tells the coach a client has a monthly report even without weekly ones', async () => {
    const client = aClient()
    await submitMonth(new Date(2026, 10, 20, 9), client, {})
    const clients = await as(app, theCoach()).get('/coach/clients')
    expect(clients.body[0]).toMatchObject({ lastReportWeek: null, hasMonthlyReport: true })
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
