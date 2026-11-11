import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { aPlan, aReport, dataWith, fakeApi } from '../test/fakeApi'
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
    await expect.element(screen.getByLabelText('Выполнение тренировок')).toHaveTextContent('75%')
    await expect.element(screen.getByLabelText('Средние шаги')).toHaveTextContent('125%')
  })

  it('shows measurement changes against last week', async () => {
    const { screen } = await renderClient({
      current: aReport({ data: dataWith({ prev: { weight: '72,4' } }) }),
    })
    await expect.element(screen.getByLabelText('Было Вес')).toHaveValue('72,4')
    await screen.getByLabelText('Стало Вес').fill('71,9')
    await expect.element(screen.getByLabelText('Разница Вес')).toHaveTextContent('-0,5')
  })

  it('saves answers automatically', async () => {
    const { screen, saves } = await renderClient()
    await screen.getByLabelText('Факт Белки').fill('115')
    await screen.getByLabelText('Энергия', { exact: true }).selectOptions('4 — хорошая')
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

  it('warns about missing values before sending, and sends after confirmation', async () => {
    const { screen, confirm } = await renderClient()
    await screen.getByLabelText('Факт Калории').fill('1850')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Не заполнено: белки, жиры'))
    await expect.element(screen.getByLabelText('Факт Калории')).toBeDisabled()
  })

  it('sends the latest answers even if typed just before tapping send', async () => {
    const { screen, saves } = await renderClient()
    await screen.getByLabelText('Факт Калории').fill('1850')
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    expect(saves.at(-1)?.fact.cal).toBe('1850')
  })

  it('does not send when the client cancels', async () => {
    const { screen, state } = await renderClient(
      {},
      vi.fn(async () => false),
    )
    await screen.getByRole('button', { name: 'Отправить тренеру' }).click()
    expect(state.current.status).toBe('DRAFT')
    await expect.element(screen.getByRole('button', { name: 'Отправить тренеру' })).toBeVisible()
  })

  it('shows an already sent report read-only', async () => {
    const { screen } = await renderClient({
      current: aReport({ status: 'SUBMITTED', data: dataWith({ fact: { cal: '1850' } }) }),
    })
    await expect.element(screen.getByText('Отчёт отправлен тренеру')).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Калории')).toHaveValue('1850')
    await expect.element(screen.getByLabelText('Факт Калории')).toBeDisabled()
  })
})

describe('report history', () => {
  it('lists past reports and opens one', async () => {
    const past = aReport({
      id: 7,
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      status: 'SUBMITTED',
      data: dataWith({ fact: { cal: '1777' } }),
    })
    const { screen } = await renderClient({ history: [past] })
    await screen.getByRole('button', { name: 'История' }).click()
    await screen.getByRole('button', { name: /02\.11 — 08\.11/ }).click()
    await expect.element(screen.getByLabelText('Факт Калории')).toHaveValue('1777')
  })
})
