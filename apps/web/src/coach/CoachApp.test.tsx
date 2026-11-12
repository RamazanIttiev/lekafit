import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { aPlan, aReport, dataWith } from '../test/fakeApi'
import { fakeBackButton } from '../test/fakeBackButton'
import { aListItem, fakeCoachApi } from '../test/fakeCoachApi'
import { CoachApp } from './CoachApp'
import { routeFromLocation } from './route'

const renderCoach = async (setup: Parameters<typeof fakeCoachApi>[0] = {}, initialRoute = '#/') => {
  const fake = fakeCoachApi(setup)
  const back = fakeBackButton()
  const shared: Array<{ url: string; text: string }> = []
  const screen = await render(
    <CoachApp
      api={fake.api}
      initialRoute={initialRoute}
      backButton={back.backButton}
      share={(url, text) => shared.push({ url, text })}
      download={() => undefined}
    />,
  )
  return { ...fake, back, screen, shared }
}

describe('client list', () => {
  it('shows clients and flags new reports', async () => {
    const { screen } = await renderCoach({
      clients: [
        aListItem({ id: 1, firstName: 'Ольга', lastName: null, unseenReports: 2 }),
        aListItem({ id: 2, firstName: 'Ира', lastName: null, lastReportWeek: null }),
        aListItem({
          id: 3,
          firstName: 'Рамазан',
          lastName: null,
          lastReportWeek: null,
          hasMonthlyReport: true,
        }),
      ],
    })
    await expect
      .element(screen.getByRole('button', { name: /Рамазан.*месячный отчёт/ }))
      .toBeVisible()
    await expect.element(screen.getByRole('button', { name: /Ольга.*новых: 2/ })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: /Ира.*отчётов нет/ })).toBeVisible()
  })

  it('tells the coach how clients join when there are none yet', async () => {
    const { screen } = await renderCoach({ clients: [] })
    await expect.element(screen.getByText(/Клиентов пока нет/)).toBeVisible()
  })

  it('lets the coach invite a client through the Telegram share sheet', async () => {
    const { screen, shared } = await renderCoach({ clients: [aListItem()] })
    await screen.getByRole('button', { name: 'Добавить клиента' }).click()
    await expect
      .poll(() => shared)
      .toEqual([{ url: 'https://t.me/lekafit_bot', text: expect.stringContaining('LekaFit') }])
  })

  it('offers the invite even when there are no clients yet', async () => {
    const { screen } = await renderCoach({ clients: [] })
    await expect.element(screen.getByRole('button', { name: 'Добавить клиента' })).toBeVisible()
  })

  it('opens a client', async () => {
    const { screen } = await renderCoach({
      clients: [aListItem({ firstName: 'Анна' })],
      profile: { id: 1, firstName: 'Анна', lastName: 'Иванова', username: null, plan: null },
    })
    await screen.getByRole('button', { name: /Анна/ }).click()
    await expect.element(screen.getByRole('heading', { name: 'Анна Иванова' })).toBeVisible()
  })
})

describe('client page', () => {
  const clientRoute = '#/coach/clients/1'

  it('edits the plan, leaving empty fields unset', async () => {
    const { screen, savedPlans } = await renderCoach(
      { profile: { id: 1, firstName: 'Анна', lastName: null, username: null, plan: aPlan() } },
      clientRoute,
    )
    await expect.element(screen.getByLabelText('Калории', { exact: true })).toHaveValue('1800')
    await screen.getByLabelText('Калории', { exact: true }).fill('1 650')
    await screen.getByLabelText('Тренировки', { exact: true }).fill('')
    await screen.getByRole('button', { name: 'Сохранить план' }).click()
    await expect.element(screen.getByText('План сохранён')).toBeVisible()
    expect(savedPlans).toEqual([aPlan({ cal: 1650, training: null })])
  })

  it('refuses to save a plan with invalid numbers', async () => {
    const { screen, savedPlans } = await renderCoach({}, clientRoute)
    await screen.getByLabelText('Калории', { exact: true }).fill('много')
    await screen.getByRole('button', { name: 'Сохранить план' }).click()
    await expect.element(screen.getByText('Проверьте значения: Калории')).toBeVisible()
    expect(savedPlans).toEqual([])
  })

  it('shows progress across weeks', async () => {
    const { screen } = await renderCoach(
      {
        reports: [
          aReport({
            id: 2,
            weekStart: '2026-11-09',
            weekEnd: '2026-11-15',
            submittedAt: '2026-11-10T09:00:00.000Z',
            data: dataWith({ now: { weight: '71,9' }, fact: { cal: '1850' } }),
          }),
          aReport({
            id: 1,
            weekStart: '2026-11-02',
            weekEnd: '2026-11-08',
            submittedAt: '2026-11-10T09:00:00.000Z',
            data: dataWith({ now: { weight: '72,4' }, fact: { cal: '1900' } }),
          }),
        ],
      },
      clientRoute,
    )
    await screen.getByRole('tab', { name: 'Динамика' }).click()
    const table = screen.getByRole('grid', { name: 'Динамика' })
    await expect.element(table).toBeVisible()
    const rows = table
      .getByRole('row')
      .elements()
      .map((row) => row.textContent)
    expect(rows[1]).toMatch(/09\.11.*71,9.*1850/)
    expect(rows[2]).toMatch(/02\.11.*72,4.*1900/)
  })

  it('opens a report from the list', async () => {
    const { screen } = await renderCoach(
      {
        reports: [
          aReport({
            id: 5,
            submittedAt: '2026-11-10T09:00:00.000Z',
            data: dataWith({ fact: { cal: '1850' } }),
          }),
        ],
      },
      clientRoute,
    )
    await screen.getByRole('tab', { name: 'Динамика' }).click()
    await screen.getByRole('button', { name: /Отчёт 09\.11 — 15\.11/ }).click()
    await expect.element(screen.getByLabelText('Факт Калории')).toHaveValue('1850')
  })
})

describe('report page', () => {
  it('opens straight from the bot link with client name and answers', async () => {
    const { screen } = await renderCoach(
      {
        profile: { id: 1, firstName: 'Анна', lastName: 'Иванова', username: 'anna', plan: null },
        reports: [
          aReport({
            id: 9,
            submittedAt: '2026-11-10T09:00:00.000Z',
            data: dataWith({ fact: { cal: '1850' }, feedback: { wins: 'Все тренировки' } }),
          }),
        ],
      },
      '#/coach/reports/9',
    )
    await expect.element(screen.getByRole('heading', { name: 'Анна Иванова' })).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Калории')).toBeDisabled()
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await expect
      .element(screen.getByLabelText('Что получилось хорошо?'))
      .toHaveValue('Все тренировки')
  })

  it('has no back button on the client list', async () => {
    const { screen, back } = await renderCoach({ clients: [aListItem({ firstName: 'Ольга' })] })
    await expect.element(screen.getByRole('button', { name: /Ольга/ })).toBeVisible()
    expect(back.isVisible()).toBe(false)
  })

  it('goes back from a client to the client list with the Telegram back button', async () => {
    const { screen, back } = await renderCoach(
      { clients: [aListItem({ firstName: 'Ольга' })] },
      '#/coach/clients/1',
    )
    await expect.poll(back.isVisible).toBe(true)
    back.press()
    await expect.element(screen.getByRole('button', { name: /Ольга/ })).toBeVisible()
    await expect.poll(back.isVisible).toBe(false)
  })

  it('goes back from a report to its client with the Telegram back button', async () => {
    const { screen, back } = await renderCoach(
      {
        profile: { id: 1, firstName: 'Анна', lastName: 'Иванова', username: 'anna', plan: null },
        reports: [aReport({ id: 9, submittedAt: '2026-11-10T09:00:00.000Z' })],
      },
      '#/coach/reports/9',
    )
    await expect.element(screen.getByRole('heading', { name: 'Анна Иванова' })).toBeVisible()
    back.press()
    await expect.element(screen.getByRole('button', { name: 'Сохранить план' })).toBeVisible()
  })

  it('shows no in-page back buttons', async () => {
    const { screen } = await renderCoach(
      { reports: [aReport({ id: 9, submittedAt: '2026-11-10T09:00:00.000Z' })] },
      '#/coach/reports/9',
    )
    await expect.element(screen.getByLabelText('Факт Калории')).toBeVisible()
    await expect
      .element(screen.getByRole('button', { name: 'Все клиенты' }))
      .not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Назад' })).not.toBeInTheDocument()
  })
})

describe('routeFromLocation', () => {
  it('opens the report named in the query, which survives Telegram rewriting the hash', () => {
    expect(
      routeFromLocation({ search: '?report=42', hash: '#tgWebAppData=abc&tgWebAppVersion=8.0' }),
    ).toBe('#/coach/reports/42')
  })

  it('falls back to the hash without a valid report param', () => {
    expect(routeFromLocation({ search: '?report=x', hash: '#/coach/clients/3' })).toBe(
      '#/coach/clients/3',
    )
  })
})
