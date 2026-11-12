import { Tabs } from '@heroui/react'
import type { Api } from '../api'
import { CurrentReport } from './components/CurrentReport'
import { Progress } from './components/Progress'

type Props = { api: Api; confirm: (message: string) => Promise<boolean> }

export const ClientApp = ({ api, confirm }: Props) => (
  <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
    <Tabs variant="primary">
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
      <Tabs.Panel id="current" className="flex flex-col gap-3">
        <CurrentReport api={api} confirm={confirm} load={api.currentReport} />
      </Tabs.Panel>
      <Tabs.Panel id="month" className="flex flex-col gap-3">
        <CurrentReport api={api} confirm={confirm} load={api.currentMonthlyReport} />
      </Tabs.Panel>
      <Tabs.Panel id="progress" className="flex flex-col gap-3">
        <Progress api={api} />
      </Tabs.Panel>
    </Tabs>
  </main>
)
