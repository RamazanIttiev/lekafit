import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { Plan } from '../api'
import { aMonthlyReport, aPlan, aReport, monthlyDataWith } from '../test/fakeApi'
import { fakeBackButton } from '../test/fakeBackButton'
import { fakeCoachApi } from '../test/fakeCoachApi'
import { CoachApp } from './CoachApp'

const fullPlan = (overrides: Partial<Plan> = {}) =>
  aPlan({ trainingMonth: 12, cardioMonth: 300, ...overrides })

const renderCoach = async (setup: Parameters<typeof fakeCoachApi>[0], initialRoute: string) => {
  const fake = fakeCoachApi(setup)
  const downloads: { url: string; fileName: string }[] = []
  const screen = await render(
    <CoachApp
      api={fake.api}
      initialRoute={initialRoute}
      backButton={fakeBackButton().backButton}
      share={() => undefined}
      download={(url, fileName) => downloads.push({ url, fileName })}
    />,
  )
  return { ...fake, downloads, screen }
}

const profile = { id: 1, firstName: 'Анна', lastName: 'Иванова', username: null, plan: fullPlan() }
const submitted = '2026-12-01T09:00:00.000Z'

describe('coach: monthly targets', () => {
  it('sets monthly workout and cardio targets alongside the weekly plan', async () => {
    const { screen, savedPlans } = await renderCoach({ profile }, '#/coach/clients/1')
    await screen.getByLabelText('Тренировки в месяц', { exact: true }).fill('12')
    await screen.getByLabelText('Кардио в месяц', { exact: true }).fill('300')
    await screen.getByRole('button', { name: 'Сохранить план' }).click()
    await screen.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect.element(screen.getByText('План сохранён')).toBeVisible()
    expect(savedPlans).toEqual([fullPlan()])
  })
})

describe('coach: monthly reports', () => {
  const monthly = aMonthlyReport({
    id: 20,
    submittedAt: submitted,
    data: monthlyDataWith({
      baseline: { weight: '75' },
      now: { weight: '71' },
      fact: { cardio: '240' },
      feedback: { questions: 'Можно больше кардио?' },
    }),
  })

  it('shows monthly dynamics and opens a monthly report from the client page', async () => {
    const { screen } = await renderCoach(
      { profile, reports: [monthly, aReport({ id: 5, submittedAt: submitted })] },
      '#/coach/clients/1',
    )
    await screen.getByRole('tab', { name: 'Динамика' }).click()
    await expect.element(screen.getByRole('grid', { name: 'Динамика по месяцам' })).toBeVisible()
    await expect.element(screen.getByRole('grid', { name: 'Динамика' })).toBeVisible()
    await screen.getByRole('button', { name: 'Отчёт за 09.11 — 09.12' }).click()
    await expect.element(screen.getByLabelText('Факт Кардио')).toHaveValue('240')
  })

  it('opens a monthly report straight from the bot link, read-only', async () => {
    const { screen } = await renderCoach({ profile, reports: [monthly] }, '#/coach/reports/20')
    await expect.element(screen.getByText('Отчёт за 09.11 — 09.12')).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Кардио')).toBeDisabled()
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('От старта Вес')).toHaveTextContent('-4')
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await expect
      .element(screen.getByLabelText('Вопросы к тренеру и пожелания на следующий месяц'))
      .toHaveValue('Можно больше кардио?')
  })
})

describe('coach: monthly photos', () => {
  const withPhotos = aMonthlyReport({
    id: 21,
    periodStart: '2026-11-09',
    submittedAt: submitted,
    photos: { front: true, side: true, back: false },
    prevPhotosReportId: 11,
  })

  it('shows this month next to last month for each angle', async () => {
    const { screen, photoRequests } = await renderCoach(
      { profile, reports: [withPhotos] },
      '#/coach/reports/21',
    )
    await screen.getByRole('tab', { name: 'Фото' }).click()
    await expect.element(screen.getByRole('img', { name: 'Фас — этот месяц' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'Фас — прошлый месяц' })).toBeVisible()
    await expect.poll(() => photoRequests).toContainEqual([11, 'front'])
    expect(photoRequests).toContainEqual([21, 'front'])
  })

  it('shows photos read-only', async () => {
    const { screen } = await renderCoach({ profile, reports: [withPhotos] }, '#/coach/reports/21')
    await screen.getByRole('tab', { name: 'Фото' }).click()
    await expect.element(screen.getByRole('img', { name: 'Фас — этот месяц' })).toBeVisible()
    await expect.element(screen.getByLabelText('Выбрать фото: Фас')).not.toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Удалить фото: Фас' }))
      .not.toBeInTheDocument()
  })

  it('hands Telegram a download link for the photo, named by the server', async () => {
    const { screen, downloads } = await renderCoach(
      { profile, reports: [withPhotos] },
      '#/coach/reports/21',
    )
    await screen.getByRole('tab', { name: 'Фото' }).click()
    await screen.getByRole('button', { name: 'Скачать фото: Профиль' }).click()
    await expect
      .poll(() => downloads)
      .toEqual([
        {
          url: 'https://example.test/api/photo-downloads/21-side',
          fileName: 'LekaFit_Анна_Иванова_2026-11_side.jpg',
        },
      ])
  })

  it('offers no download for a missing photo', async () => {
    const { screen } = await renderCoach({ profile, reports: [withPhotos] }, '#/coach/reports/21')
    await screen.getByRole('tab', { name: 'Фото' }).click()
    await expect
      .element(screen.getByRole('button', { name: 'Скачать фото: Профиль' }))
      .toBeVisible()
    await expect
      .element(screen.getByRole('button', { name: 'Скачать фото: Спина' }))
      .not.toBeInTheDocument()
  })
})
