import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { aPlan, aReport, dataWith, fakeApi, filledData } from '../test/fakeApi'
import { ClientApp } from './ClientApp'

const renderClient = async (
  setup: Parameters<typeof fakeApi>[0] = {},
  confirm = vi.fn(async (_message: string) => true),
) => {
  const fake = fakeApi(setup)
  const screen = await render(<ClientApp api={fake.api} confirm={confirm} />)
  return { ...fake, confirm, screen }
}

describe('weekly report form', () => {
  it('shows the reporting period and the coach plan', async () => {
    const { screen } = await renderClient()
    await expect.element(screen.getByText('09.11 — 15.11')).toBeVisible()
    await expect.element(screen.getByLabelText('План Калории')).toHaveTextContent('1 800')
  })

  it('tells the client when the coach has not set a plan yet', async () => {
    const { screen } = await renderClient({ current: aReport({ plan: null }) })
    await expect.element(screen.getByText('Тренер ещё не задал план')).toBeVisible()
  })

  it('lets the client fill only the plan values the coach has not set', async () => {
    const { screen } = await renderClient({ current: aReport({ plan: aPlan({ cal: null }) }) })
    await screen.getByLabelText('План Калории').fill('2 000')
    await screen.getByLabelText('Факт Калории').fill('2 100')
    await expect.element(screen.getByLabelText('Разница Калории')).toHaveTextContent('+100')
    await expect.element(screen.getByLabelText('План Белки')).toHaveTextContent('120')
    expect(screen.getByLabelText('План Белки').element().tagName).toBe('OUTPUT')
  })

  it('calculates the difference from the plan as the client types', async () => {
    const { screen } = await renderClient()
    await screen.getByLabelText('Факт Калории').fill('1 850')
    await expect.element(screen.getByLabelText('Разница Калории')).toHaveTextContent('+50')
  })

  it('shows workout and step completion', async () => {
    const { screen } = await renderClient({
      current: aReport({ plan: aPlan({ training: 4, steps: 8000 }) }),
    })
    await screen.getByLabelText('Факт Тренировки').fill('3')
    await screen.getByLabelText('Факт Шаги').fill('10000')
    await expect.element(screen.getByLabelText('Тренировки')).toHaveTextContent('75%')
    await expect.element(screen.getByLabelText('Средние шаги')).toHaveTextContent('125%')
  })

  it('shows one report section at a time, switched by icon tabs', async () => {
    const { screen } = await renderClient()
    await expect.element(screen.getByLabelText('Факт Калории')).toBeVisible()
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await expect.element(screen.getByLabelText('Что получилось хорошо?')).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Калории')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('tab', { name: 'Замеры' })).toHaveTextContent('')
  })

  it('shows measurement changes against last week', async () => {
    const { screen } = await renderClient({
      current: aReport({ data: dataWith({ prev: { weight: '72,4' } }) }),
    })
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('Было Вес')).toHaveTextContent('72,4')
    await expect.element(screen.getByRole('textbox', { name: 'Было Вес' })).not.toBeInTheDocument()
    await screen.getByLabelText('Стало Вес').fill('71,9')
    await expect.element(screen.getByLabelText('Разница Вес')).toHaveTextContent('-0,5')
  })

  it('shows a dash for "before" when there is no previous measurement', async () => {
    const { screen } = await renderClient()
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('Было Талия')).toHaveTextContent('—')
  })

  it('sends the first report without previous measurements', async () => {
    const { screen } = await renderClient({
      current: aReport({ data: { ...filledData(), prev: dataWith({}).prev } }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
  })

  it('saves answers automatically', async () => {
    const { screen, saves } = await renderClient()
    await screen.getByLabelText('Факт Белки').fill('115')
    await screen.getByRole('tab', { name: 'Самочувствие' }).click()
    await screen.getByRole('button', { name: /Энергия/ }).click()
    await screen.getByRole('option', { name: '4 — хорошая' }).click()
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await screen.getByLabelText('Что получилось хорошо?').fill('Все тренировки')
    await expect.element(screen.getByText('Сохранено')).toBeVisible()
    await expect
      .poll(() => saves.at(-1))
      .toMatchObject({
        fact: { protein: '115' },
        wellbeing: { energy: '4 — хорошая' },
        feedback: { wins: 'Все тренировки' },
      })
  })

  it('sends a complete report after confirmation', async () => {
    const { screen, confirm } = await renderClient({
      current: aReport({ data: filledData() }),
    })
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('sends the latest answers even if typed just before tapping send', async () => {
    const { screen, saves } = await renderClient({
      current: aReport({ data: filledData() }),
    })
    await screen.getByLabelText('Факт Калории').fill('1850')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    expect(saves.at(-1)?.fact.cal).toBe('1850')
  })

  it('does not send when the client cancels', async () => {
    const { screen, state } = await renderClient(
      { current: aReport({ data: filledData() }) },
      vi.fn(async () => false),
    )
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    expect(state.current.status).toBe('DRAFT')
    await expect.element(screen.getByRole('button', { name: 'Отправить тренеру' })).toBeVisible()
  })

  it('refuses to send while a field is empty, alerting and outlining the empty fields', async () => {
    const { screen, confirm, state } = await renderClient({
      current: aReport({ data: filledData() }),
    })
    await screen.getByLabelText('Факт Калории').fill('')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect
      .element(screen.getByText('Заполните все поля, чтобы отправить отчёт'))
      .toBeVisible()
    await expect.element(screen.getByLabelText('Факт Калории')).toBeInvalid()
    await expect.element(screen.getByLabelText('Факт Белки')).toBeValid()
    expect(confirm).not.toHaveBeenCalled()
    expect(state.current.status).toBe('DRAFT')
  })

  it('outlines empty fields on every tab, including dropdowns', async () => {
    const data = filledData()
    const { screen } = await renderClient({
      current: aReport({ data: { ...data, wellbeing: { ...data.wellbeing, sleep: '' } } }),
    })
    await screen.getByRole('tab', { name: 'Самочувствие' }).click()
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await screen.getByLabelText('Что было сложно?').fill('')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByLabelText('Что было сложно?')).toBeInvalid()
    await screen.getByRole('tab', { name: 'Самочувствие' }).click()
    await expect.element(screen.getByLabelText('Комментарии по самочувствию')).toBeValid()
    const sleepSelect = screen.getByRole('button', { name: /Сон/ }).element().parentElement
    expect(sleepSelect).toHaveAttribute('data-invalid', 'true')
  })

  it('clears the alert and the outlines after three seconds', async () => {
    const { screen } = await renderClient({ current: aReport({ data: filledData() }) })
    await screen.getByLabelText('Факт Калории').fill('')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect
      .element(screen.getByText('Заполните все поля, чтобы отправить отчёт'))
      .toBeVisible()
    await expect
      .element(screen.getByText('Заполните все поля, чтобы отправить отчёт'), { timeout: 4000 })
      .not.toBeInTheDocument()
    await expect.element(screen.getByLabelText('Факт Калории')).toBeValid()
  })

  it('shows an already sent report read-only', async () => {
    const { screen } = await renderClient({
      current: aReport({ status: 'SUBMITTED', data: dataWith({ fact: { cal: '1850' } }) }),
    })
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
  })
})

describe('report history', () => {
  it('shows weekly dynamics in the Progress tab', async () => {
    const past = aReport({
      id: 7,
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      status: 'SUBMITTED',
      data: dataWith({ now: { weight: '82', waist: '65' }, fact: { cal: '1200', steps: '12000' } }),
    })
    const { screen } = await renderClient({ history: [past] })
    await screen.getByRole('tab', { name: 'Прогресс' }).click()
    await expect.element(screen.getByText('Динамика').first()).toBeVisible()
    const table = screen.getByRole('grid', { name: 'Динамика' })
    await expect.element(table).toBeVisible()
    const rows = table
      .getByRole('row')
      .elements()
      .map((row) => row.textContent)
    expect(rows[1]).toMatch(/02\.11.*82.*65.*1200.*12000/)
  })
})
