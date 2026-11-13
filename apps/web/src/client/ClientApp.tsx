import { Tabs } from '@heroui/react'
import type { Api } from '../api'
import { CurrentReport } from './components/CurrentReport'
import { Progress } from './components/Progress'
import { WeeklyReport } from './components/WeeklyReport'
import type { ClientTab } from './tab'

type Props = {
  api: Api
  confirm: (message: string) => Promise<boolean>
  initialTab?: ClientTab | undefined
}

export const ClientApp = ({ api, confirm, initialTab = 'current' }: Props) => (
  <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
    <Tabs variant="primary" defaultSelectedKey={initialTab}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Отчёты">
          <Tabs.Tab id="current">
            Неделя
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="month">
            Месяц
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="progress">
            Прогресс
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="current" className="flex flex-col gap-3 p-0">
        <WeeklyReport api={api} confirm={confirm} />
      </Tabs.Panel>
      <Tabs.Panel id="month" className="flex flex-col gap-3 p-0">
        <CurrentReport api={api} confirm={confirm} load={api.currentMonthlyReport} />
      </Tabs.Panel>
      <Tabs.Panel id="progress" className="flex flex-col gap-3 p-0">
        <Progress api={api} />
      </Tabs.Panel>
    </Tabs>
  </main>
)
