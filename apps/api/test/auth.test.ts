import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aClient, as, initDataFor, resetDatabase, startApp, theCoach } from './support'

const app = await startApp()
afterAll(() => app.close())
beforeEach(resetDatabase)
beforeAll(resetDatabase)

const server = () => app.getHttpServer()

describe('GET /me', () => {
  it('rejects requests without Telegram init data', async () => {
    await request(server()).get('/me').expect(401)
  })

  it('rejects init data signed with another bot token', async () => {
    const forged = initDataFor(aClient(), { token: '999:OTHER' })
    await request(server()).get('/me').set('Authorization', `tma ${forged}`).expect(401)
  })

  it('rejects init data older than one day', async () => {
    const stale = initDataFor(aClient(), { authDate: new Date(Date.now() - 25 * 3600 * 1000) })
    await request(server()).get('/me').set('Authorization', `tma ${stale}`).expect(401)
  })

  it('registers a new Telegram user as a client', async () => {
    const user = aClient()
    const res = await as(app, user).get('/me').expect(200)
    expect(res.body).toMatchObject({
      telegramId: user.id,
      firstName: 'Анна',
      lastName: 'Иванова',
      username: 'anna',
      role: 'CLIENT',
    })
  })

  it('returns the same user on later visits and keeps the name up to date', async () => {
    const user = aClient()
    const first = await as(app, user).get('/me')
    const second = await as(app, { ...user, first_name: 'Аня' }).get('/me')
    expect(second.body.id).toBe(first.body.id)
    expect(second.body.firstName).toBe('Аня')
  })

  it('supports Telegram ids beyond 32-bit range', async () => {
    const user = aClient({ id: 7_512_345_678 })
    const res = await as(app, user).get('/me').expect(200)
    expect(res.body.telegramId).toBe(7_512_345_678)
  })

  it('recognises the configured coach', async () => {
    const res = await as(app, theCoach()).get('/me').expect(200)
    expect(res.body.role).toBe('COACH')
  })
})
