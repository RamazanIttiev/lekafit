import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { aMonthlyReport, aPlan, fakeApi, filledMonthlyData, monthlyDataWith } from '../test/fakeApi'
import { ClientApp } from './ClientApp'

const renderMonthly = async (setup: Parameters<typeof fakeApi>[0] = {}) => {
  const fake = fakeApi(setup)
  const confirm = vi.fn(async (_message: string) => true)
  const screen = await render(<ClientApp api={fake.api} confirm={confirm} />)
  await screen.getByRole('tab', { name: 'Месяц' }).click()
  return { ...fake, confirm, screen }
}

describe('monthly report', () => {
  it('shows the reporting month', async () => {
    const { screen } = await renderMonthly()
    await expect.element(screen.getByRole('heading', { name: 'Ноябрь 2026' })).toBeVisible()
  })

  it('asks for monthly averages, total workouts and optional cardio', async () => {
    const { screen } = await renderMonthly()
    await expect.element(screen.getByText(/Среднее за месяц/)).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Кардио')).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Силовые тренировки')).toBeVisible()
  })

  it('lets the client set monthly workout and cardio targets, but shows the coach plan for nutrition', async () => {
    const { screen } = await renderMonthly({ monthly: aMonthlyReport({ plan: aPlan() }) })
    await expect.element(screen.getByLabelText('План Калории')).toHaveTextContent('1 800')
    await screen.getByLabelText('План Силовые тренировки').fill('12')
    await screen.getByLabelText('Факт Силовые тренировки').fill('9')
    await expect.element(screen.getByLabelText('Тренировки')).toHaveTextContent('75%')
  })

  it('records the goal and the start date of coaching', async () => {
    const { screen, monthlySaves } = await renderMonthly()
    await screen.getByRole('button', { name: /Основная цель/ }).click()
    await screen.getByRole('option', { name: 'Рекомпозиция тела' }).click()
    await screen.getByLabelText('Начало сопровождения').fill('2026-10-01')
    await expect
      .poll(() => monthlySaves.at(-1))
      .toMatchObject({ about: { goal: 'Рекомпозиция тела', startDate: '2026-10-01' } })
  })

  it('shows change over the month and since the start', async () => {
    const { screen } = await renderMonthly({
      monthly: aMonthlyReport({
        data: monthlyDataWith({ baseline: { weight: '75' }, prev: { weight: '72' } }),
      }),
    })
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('Старт Вес')).toHaveTextContent('75')
    await expect.element(screen.getByLabelText('Было Вес')).toHaveTextContent('72')
    await screen.getByLabelText('Стало Вес').fill('71')
    await expect.element(screen.getByLabelText('За месяц Вес')).toHaveTextContent('-1')
    await expect.element(screen.getByLabelText('От старта Вес')).toHaveTextContent('-4')
  })

  it('lets the client enter start values in the first month', async () => {
    const { screen, monthlySaves } = await renderMonthly()
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await screen.getByLabelText('Старт Обхват бедра').fill('58')
    await expect.poll(() => monthlySaves.at(-1)?.baseline).toMatchObject({ thigh: '58' })
  })

  it('asks the monthly wellbeing and feedback questions', async () => {
    const { screen } = await renderMonthly()
    await screen.getByRole('tab', { name: 'Самочувствие' }).click()
    await expect.element(screen.getByRole('button', { name: /Соблюдение плана/ })).toBeVisible()
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await expect
      .element(screen.getByLabelText('Вопросы к тренеру и пожелания на следующий месяц'))
      .toBeVisible()
  })

  it('sends a complete monthly report without cardio', async () => {
    const data = filledMonthlyData()
    const { screen, state } = await renderMonthly({
      monthly: aMonthlyReport({
        data: { ...data, fact: { ...data.fact, cardio: '' } },
        photos: { front: true, side: true, back: true },
      }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    expect(state.monthly.submittedAt).not.toBeNull()
  })

  it('refuses to send while a photo is missing', async () => {
    const { screen, confirm, state } = await renderMonthly({
      monthly: aMonthlyReport({
        data: filledMonthlyData(),
        photos: { front: true, side: false, back: true },
      }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect
      .element(screen.getByText('Заполните все поля, чтобы отправить отчёт'))
      .toBeVisible()
    expect(confirm).not.toHaveBeenCalled()
    expect(state.monthly.submittedAt).toBeNull()
  })

  it('refuses to send while a monthly field is empty', async () => {
    const data = filledMonthlyData()
    const { screen, confirm } = await renderMonthly({
      monthly: aMonthlyReport({ data: { ...data, fact: { ...data.fact, steps: '' } } }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByLabelText('Факт Шаги')).toBeInvalid()
    expect(confirm).not.toHaveBeenCalled()
  })
})

describe('monthly progress', () => {
  it('shows monthly weight, waist and change since the start in the Progress tab', async () => {
    const past = aMonthlyReport({
      id: 30,
      weekStart: '2026-10-01',
      weekEnd: '2026-10-31',
      submittedAt: '2026-11-01T09:00:00.000Z',
      data: monthlyDataWith({ baseline: { weight: '75' }, now: { weight: '72', waist: '68' } }),
    })
    const fake = fakeApi({ monthlyHistory: [past] })
    const screen = await render(<ClientApp api={fake.api} confirm={async () => true} />)
    await screen.getByRole('tab', { name: 'Прогресс' }).click()
    const table = screen.getByRole('grid', { name: 'Динамика по месяцам' })
    await expect.element(table.getByRole('rowheader', { name: 'Октябрь 2026' })).toBeVisible()
    await expect.element(table.getByRole('gridcell', { name: '-3' })).toBeVisible()
    await expect.element(table.getByRole('gridcell', { name: '68' })).toBeVisible()
  })
})

describe('monthly targets from the coach', () => {
  it('shows the coach monthly workout and cardio targets instead of asking for them', async () => {
    const { screen } = await renderMonthly({
      monthly: aMonthlyReport({ plan: aPlan({ trainingMonth: 12, cardioMonth: 300 }) }),
    })
    await expect.element(screen.getByLabelText('План Силовые тренировки')).toHaveTextContent('12')
    await expect.element(screen.getByLabelText('План Кардио')).toHaveTextContent('300')
    await screen.getByLabelText('Факт Силовые тренировки').fill('9')
    await expect.element(screen.getByLabelText('Тренировки')).toHaveTextContent('75%')
  })
})

const aPhoto = (name = 'photo.png'): Promise<File> => {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 60
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(new File([b], name, { type: 'image/png' })) : reject(new Error('blob'))),
      'image/png',
    ),
  )
}

describe('monthly photos', () => {
  const openPhotos = async (screen: Awaited<ReturnType<typeof renderMonthly>>['screen']) => {
    await screen.getByRole('tab', { name: 'Фото' }).click()
  }

  it('keeps photos in their own tab, the last of five', async () => {
    const { screen } = await renderMonthly()
    const sections = screen.getByRole('tablist', { name: 'Разделы отчёта' })
    const names = sections
      .getByRole('tab')
      .elements()
      .map((tab) => tab.getAttribute('aria-label'))
    expect(names).toEqual([
      'Питание и активность',
      'Замеры',
      'Самочувствие',
      'Обратная связь',
      'Фото',
    ])
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('Выбрать фото: Фас')).not.toBeInTheDocument()
  })

  it('uploads a resized JPEG for the chosen angle and shows it', async () => {
    const { screen, uploads } = await renderMonthly()
    await openPhotos(screen)
    await screen.getByLabelText('Выбрать фото: Фас').upload(await aPhoto())
    await expect
      .poll(() => uploads.map((u) => [u.angle, u.type]))
      .toEqual([['front', 'image/jpeg']])
    await expect.element(screen.getByRole('img', { name: 'Фас — этот месяц' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Удалить фото: Фас' })).toBeVisible()
  })

  it('removes a photo', async () => {
    const { screen, state } = await renderMonthly({
      monthly: aMonthlyReport({ photos: { front: true, side: false, back: false } }),
    })
    await openPhotos(screen)
    await expect.element(screen.getByRole('img', { name: 'Фас — этот месяц' })).toBeVisible()
    await screen.getByRole('button', { name: 'Удалить фото: Фас' }).click()
    await expect
      .element(screen.getByRole('img', { name: 'Фас — этот месяц' }))
      .not.toBeInTheDocument()
    expect(state.monthly.photos.front).toBe(false)
  })

  it('shows last month photos next to the slots', async () => {
    const { screen } = await renderMonthly({
      monthly: aMonthlyReport({ prevPhotosReportId: 1 }),
    })
    await openPhotos(screen)
    await expect.element(screen.getByRole('img', { name: 'Спина — прошлый месяц' })).toBeVisible()
  })

  it('says there is nothing to compare with in the first month', async () => {
    const { screen } = await renderMonthly()
    await openPhotos(screen)
    await expect.element(screen.getByText('В прошлом месяце фото нет').first()).toBeVisible()
  })

  it('outlines the missing photos when the client tries to send', async () => {
    const { screen } = await renderMonthly({
      monthly: aMonthlyReport({
        data: filledMonthlyData(),
        photos: { front: true, side: false, back: true },
      }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await openPhotos(screen)
    await expect.element(screen.getByLabelText('Выбрать фото: Профиль')).toBeInvalid()
    await expect.element(screen.getByLabelText('Выбрать фото: Фас')).toBeValid()
  })

  it('tells the client when a file cannot be used as a photo', async () => {
    const { screen, uploads } = await renderMonthly()
    await openPhotos(screen)
    await screen
      .getByLabelText('Выбрать фото: Профиль')
      .upload(new File(['oops'], 'broken.jpg', { type: 'image/jpeg' }))
    await expect.element(screen.getByText('Не удалось открыть фото')).toBeVisible()
    expect(uploads).toEqual([])
  })
})
