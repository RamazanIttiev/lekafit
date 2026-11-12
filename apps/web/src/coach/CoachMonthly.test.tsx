import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { aMonthlyReport, aPlan, aReport, monthlyDataWith } from '../test/fakeApi'
import { fakeBackButton } from '../test/fakeBackButton'
import { fakeCoachApi } from '../test/fakeCoachApi'
import { CoachApp } from './CoachApp'

const renderCoach = async (setup: Parameters<typeof fakeCoachApi>[0], initialRoute: string) => {
  const fake = fakeCoachApi(setup)
  const screen = await render(
    <CoachApp
      api={fake.api}
      initialRoute={initialRoute}
      backButton={fakeBackButton().backButton}
      share={() => undefined}
    />,
  )
  return { ...fake, screen }
}

const profile = { id: 1, firstName: 'Анна', lastName: 'Иванова', username: null, plan: aPlan() }
const submitted = '2026-12-01T09:00:00.000Z'

describe('coach: monthly targets', () => {
  it('sets monthly workout and cardio targets alongside the weekly plan', async () => {
    const { screen, savedPlans } = await renderCoach({ profile }, '#/coach/clients/1')
    await screen.getByLabelText('Тренировки в месяц', { exact: true }).fill('12')
    await screen.getByLabelText('Кардио в месяц', { exact: true }).fill('300')
    await screen.getByRole('button', { name: 'Сохранить план' }).click()
    await expect.element(screen.getByText('План сохранён')).toBeVisible()
    expect(savedPlans).toEqual([aPlan({ trainingMonth: 12, cardioMonth: 300 })])
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
    await screen.getByRole('button', { name: 'Отчёт за Ноябрь 2026' }).click()
    await expect.element(screen.getByLabelText('Факт Кардио')).toHaveValue('240')
  })

  it('opens a monthly report straight from the bot link, read-only', async () => {
    const { screen } = await renderCoach({ profile, reports: [monthly] }, '#/coach/reports/20')
    await expect.element(screen.getByText('Отчёт за Ноябрь 2026')).toBeVisible()
    await expect.element(screen.getByLabelText('Факт Кардио')).toBeDisabled()
    await screen.getByRole('tab', { name: 'Замеры' }).click()
    await expect.element(screen.getByLabelText('От старта Вес')).toHaveTextContent('-4')
    await screen.getByRole('tab', { name: 'Обратная связь' }).click()
    await expect
      .element(screen.getByLabelText('Вопросы к тренеру и пожелания на следующий месяц'))
      .toHaveValue('Можно больше кардио?')
  })
})
