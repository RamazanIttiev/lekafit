import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { aClient, as, resetDatabase, startApp, type TelegramUser, theCoach } from './support'

const appAt = (date: Date) => startApp({ now: () => date })
const app = await appAt(new Date(2026, 10, 12, 9))
afterAll(() => app.close())
beforeEach(resetDatabase)

const MONTHLY = '/reports/current?kind=monthly'
const jpeg = (marker: string) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(marker)])
const photoUrl = (reportId: number, angle: string) => `/reports/${reportId}/photos/${angle}`

const monthlyDraft = async (client: TelegramUser) => {
  const res = await as(app, client).get(MONTHLY).expect(200)
  return res.body.id as number
}

const uploadAll = async (client: TelegramUser, reportId: number, marker = 'now') => {
  for (const angle of ['front', 'side', 'back']) {
    await as(app, client)
      .upload(photoUrl(reportId, angle), jpeg(`${marker}-${angle}`))
      .expect(200)
  }
}

describe('uploading monthly photos', () => {
  it('stores a photo and serves it back to the owner with its type, privately', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'front'), jpeg('front')).expect(200)
    const res = await as(app, client).get(photoUrl(id, 'front')).buffer(true).expect(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(Buffer.compare(res.body, jpeg('front'))).toBe(0)
  })

  it('reports which photos the draft has', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    const res = await as(app, client).upload(photoUrl(id, 'side'), jpeg('s'), 'image/png')
    expect(res.body.photos).toEqual({ front: false, side: true, back: false })
    const report = await as(app, client).get(MONTHLY)
    expect(report.body.photos).toEqual({ front: false, side: true, back: false })
  })

  it('replaces the photo for the same angle', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'back'), jpeg('old')).expect(200)
    await as(app, client).upload(photoUrl(id, 'back'), jpeg('new')).expect(200)
    const res = await as(app, client).get(photoUrl(id, 'back')).buffer(true)
    expect(Buffer.compare(res.body, jpeg('new'))).toBe(0)
  })

  it('removes a photo', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'front'), jpeg('f')).expect(200)
    const res = await as(app, client).delete(photoUrl(id, 'front')).expect(200)
    expect(res.body.photos.front).toBe(false)
    await as(app, client).get(photoUrl(id, 'front')).expect(404)
  })

  it('accepts webp', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'front'), jpeg('w'), 'image/webp').expect(200)
  })

  it('rejects other file types', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    const res = await as(app, client)
      .upload(photoUrl(id, 'front'), jpeg('x'), 'image/gif')
      .expect(400)
    expect(res.body.message).toBe('Нужно фото в формате JPEG, PNG или WebP')
  })

  it('stores the plain image type when the upload names it with parameters', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client)
      .upload(photoUrl(id, 'front'), jpeg('p'), 'Image/JPEG; charset=binary')
      .expect(200)
    const res = await as(app, client).get(photoUrl(id, 'front')).expect(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
  })

  it('marks every angle once all three photos are uploaded', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    const res = await as(app, client).get(MONTHLY)
    expect(res.body.photos).toEqual({ front: true, side: true, back: true })
  })

  it('rejects an empty upload', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'front'), Buffer.alloc(0)).expect(400)
  })

  it('rejects photos over 5 MB', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client)
      .upload(photoUrl(id, 'front'), Buffer.alloc(5 * 1024 * 1024 + 1))
      .expect(413)
  })

  it('rejects an unknown angle', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    const res = await as(app, client).upload(photoUrl(id, 'top'), jpeg('t')).expect(400)
    expect(res.body.message).toBe('Неизвестный ракурс')
  })

  it('refuses photos on a weekly report', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    const res = await as(app, client)
      .upload(photoUrl(weekly.body.id, 'front'), jpeg('f'))
      .expect(409)
    expect(res.body.message).toBe('Фото добавляются только в отчёт за месяц')
  })

  it('refuses changes after the report is sent', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).post(`/reports/${id}/submit`).expect(200)
    const late = await as(app, client).upload(photoUrl(id, 'front'), jpeg('late')).expect(409)
    expect(late.body.message).toBe('Отчёт уже отправлен')
    await as(app, client).delete(photoUrl(id, 'front')).expect(409)
  })

  it("hides one client's photos from another", async () => {
    const owner = aClient()
    const id = await monthlyDraft(owner)
    await as(app, owner).upload(photoUrl(id, 'front'), jpeg('f')).expect(200)
    const stranger = aClient()
    await as(app, stranger).get(photoUrl(id, 'front')).expect(404)
    await as(app, stranger).upload(photoUrl(id, 'front'), jpeg('x')).expect(404)
    await as(app, stranger).delete(photoUrl(id, 'front')).expect(404)
  })
})

describe('photos are required to send a monthly report', () => {
  it('refuses to send while photos are missing, naming them', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'side'), jpeg('s')).expect(200)
    const res = await as(app, client).post(`/reports/${id}/submit`).expect(400)
    expect(res.body.message).toBe('Добавьте фото: Фас, Спина')
    const draft = await as(app, client).get(MONTHLY)
    expect(draft.body.submittedAt).toBeNull()
  })

  it('sends once all three photos are there', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).post(`/reports/${id}/submit`).expect(200)
  })

  it('does not ask for photos in a weekly report', async () => {
    const client = aClient()
    const weekly = await as(app, client).get('/reports/current')
    await as(app, client).post(`/reports/${weekly.body.id}/submit`).expect(200)
  })
})

describe('last month photos', () => {
  it('points the new draft at last month report so its photos can be shown', async () => {
    const client = aClient()
    const november = await monthlyDraft(client)
    await uploadAll(client, november, 'nov')
    await as(app, client).post(`/reports/${november}/submit`).expect(200)
    const decemberApp = await appAt(new Date(2026, 11, 10, 9))
    const december = await as(decemberApp, client).get(MONTHLY)
    await decemberApp.close()
    expect(december.body.prevPhotosReportId).toBe(november)
    expect(december.body.photos).toEqual({ front: false, side: false, back: false })
    const old = await as(app, client).get(photoUrl(november, 'side')).buffer(true).expect(200)
    expect(Buffer.compare(old.body, jpeg('nov-side'))).toBe(0)
  })

  it('points at the most recent of several past months', async () => {
    const client = aClient()
    const submitIn = async (date: Date) => {
      const monthApp = await appAt(date)
      const draft = await as(monthApp, client).get(MONTHLY)
      await uploadAll(client, draft.body.id)
      await as(monthApp, client).post(`/reports/${draft.body.id}/submit`).expect(200)
      await monthApp.close()
      return draft.body.id as number
    }
    const november = await submitIn(new Date(2026, 10, 15, 9))
    await submitIn(new Date(2026, 9, 15, 9))
    const decemberApp = await appAt(new Date(2026, 11, 10, 9))
    const december = await as(decemberApp, client).get(MONTHLY)
    await decemberApp.close()
    expect(december.body.prevPhotosReportId).toBe(november)
  })

  it('has no previous photos in the first month', async () => {
    const res = await as(app, aClient()).get(MONTHLY)
    expect(res.body.prevPhotosReportId).toBeNull()
  })
})

describe('coach access to photos', () => {
  it('lets the coach view photos of a sent report', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).post(`/reports/${id}/submit`).expect(200)
    const res = await as(app, theCoach())
      .get(`/coach${photoUrl(id, 'back')}`)
      .buffer(true)
      .expect(200)
    expect(Buffer.compare(res.body, jpeg('now-back'))).toBe(0)
    expect(res.headers['cache-control']).toBe('private, no-store')
  })

  it('hides photos of a draft from the coach', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client).upload(photoUrl(id, 'front'), jpeg('f')).expect(200)
    await as(app, theCoach())
      .get(`/coach${photoUrl(id, 'front')}`)
      .expect(404)
  })

  it('keeps clients out of the coach photo endpoint', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await as(app, client)
      .get(`/coach${photoUrl(id, 'front')}`)
      .expect(403)
  })

  it('returns 404 for a missing photo', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).delete(photoUrl(id, 'side')).expect(200)
    await as(app, client).upload(photoUrl(id, 'side'), jpeg('s')).expect(200)
    await as(app, client).post(`/reports/${id}/submit`).expect(200)
    await as(app, theCoach())
      .get(`/coach${photoUrl(999999, 'front')}`)
      .expect(404)
  })
})

describe('coach photo download links', () => {
  const sentWithPhotos = async (client: TelegramUser) => {
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).post(`/reports/${id}/submit`).expect(200)
    return id
  }

  const linkFor = async (id: number, angle: string) => {
    const res = await as(app, theCoach())
      .post(`/coach/reports/${id}/photos/${angle}/link`)
      .expect(200)
    return res.body.url as string
  }

  it('names the file after the client, month and angle', async () => {
    const id = await sentWithPhotos(aClient({ first_name: 'Анна', last_name: 'Иванова' }))
    const res = await as(app, theCoach()).post(`/coach/reports/${id}/photos/back/link`).expect(200)
    expect(res.body.fileName).toBe('LekaFit_Анна_Иванова_2026-11_back.jpg')
  })

  const pathOf = (url: string) => url.replace('https://example.test/api', '')

  it('gives the coach a link that downloads the photo without signing in', async () => {
    const id = await sentWithPhotos(aClient({ first_name: 'Анна', last_name: 'Иванова' }))
    const url = await linkFor(id, 'side')
    expect(url.startsWith('https://example.test/api/photo-downloads/')).toBe(true)
    const res = await request(app.getHttpServer()).get(pathOf(url)).buffer(true).expect(200)
    expect(Buffer.compare(res.body, jpeg('now-side'))).toBe(0)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="LekaFit_2026-11_side.jpg"; filename*=UTF-8''${encodeURIComponent('LekaFit_Анна_Иванова_2026-11_side.jpg')}`,
    )
  })

  it('stops working after five minutes', async () => {
    const id = await sentWithPhotos(aClient())
    const url = await linkFor(id, 'front')
    const later = await appAt(new Date(2026, 10, 12, 9, 5, 1))
    await request(later.getHttpServer()).get(pathOf(url)).expect(404)
    await later.close()
  })

  it('still works at exactly five minutes', async () => {
    const id = await sentWithPhotos(aClient())
    const url = await linkFor(id, 'front')
    const later = await appAt(new Date(2026, 10, 12, 9, 5, 0))
    await request(later.getHttpServer()).get(pathOf(url)).expect(200)
    await later.close()
  })

  it('rejects a link that was tampered with', async () => {
    const id = await sentWithPhotos(aClient())
    const url = await linkFor(id, 'front')
    const [payload, signature] = pathOf(url).replace('/photo-downloads/', '').split('.')
    const otherAngle = Buffer.from(
      Buffer.from(payload ?? '', 'base64url')
        .toString()
        .replace('front', 'back'),
    ).toString('base64url')
    await request(app.getHttpServer())
      .get(`/photo-downloads/${otherAngle}.${signature}`)
      .expect(404)
    await request(app.getHttpServer()).get('/photo-downloads/garbage').expect(404)
  })

  it('only gives links to the coach, and only for sent reports', async () => {
    const client = aClient()
    const id = await monthlyDraft(client)
    await uploadAll(client, id)
    await as(app, client).post(`/coach/reports/${id}/photos/front/link`).expect(403)
    await as(app, theCoach()).post(`/coach/reports/${id}/photos/front/link`).expect(404)
  })

  it('rejects unknown angles and reports', async () => {
    const id = await sentWithPhotos(aClient())
    await as(app, theCoach()).post(`/coach/reports/${id}/photos/top/link`).expect(400)
    await as(app, theCoach()).post('/coach/reports/999999/photos/front/link').expect(404)
  })
})
