import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'
import { fakeApi } from './test/fakeApi'
import { aListItem, fakeCoachApi } from './test/fakeCoachApi'

const renderAs = async (role: 'CLIENT' | 'COACH') => {
  const client = fakeApi()
  const api = {
    ...client.api,
    me: async () => ({
      id: 1,
      telegramId: 1,
      firstName: 'Лека',
      lastName: null,
      username: null,
      role,
    }),
  }
  const coach = fakeCoachApi({ clients: [aListItem({ firstName: 'Ольга' })] })
  return render(
    <App api={api} coachApi={coach.api} confirm={vi.fn(async () => true)} initialRoute="#/" />,
  )
}

describe('App', () => {
  it('shows the weekly report to clients', async () => {
    const screen = await renderAs('CLIENT')
    await expect.element(screen.getByRole('button', { name: 'Отправить тренеру' })).toBeVisible()
  })

  it('shows the client list to the coach', async () => {
    const screen = await renderAs('COACH')
    await expect.element(screen.getByRole('button', { name: /Ольга/ })).toBeVisible()
  })
})
