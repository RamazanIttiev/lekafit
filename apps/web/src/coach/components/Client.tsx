import { Button, Tabs } from '@heroui/react'
import { useCallback } from 'react'
import type { CoachApi } from '../../api'
import { CenteredSpinner } from '../../components/CenteredSpinner'
import { Notice } from '../../components/Notice'
import { Dynamics } from '../../dynamics/Dynamics'
import { MonthlyDynamics } from '../../dynamics/MonthlyDynamics'
import { fullName, reportTitle } from '../labels'
import type { Route } from '../route'
import { Loading, useLoad } from '../useLoad'
import { PlanEditor } from './PlanEditor'

export const Client = ({ api, id, go }: { api: CoachApi; id: number; go: (r: Route) => void }) => {
  const profile = useLoad(useCallback(() => api.client(id), [api, id]))
  const reports = useLoad(useCallback(() => api.clientReports(id), [api, id]))
  if (!profile.value || !reports.value)
    return (
      <Loading error={profile.error ?? reports.error}>
        <CenteredSpinner />
      </Loading>
    )
  const weekly = reports.value.flatMap((r) => (r.kind === 'WEEKLY' ? [r] : []))
  const monthly = reports.value.flatMap((r) => (r.kind === 'MONTHLY' ? [r] : []))
  return (
    <>
      <h1>{fullName(profile.value)}</h1>
      <Tabs className="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Разделы клиента">
            <Tabs.Tab id="plan">
              План
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="progress">
              Динамика
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel className="p-0 pt-3" id="plan">
          <PlanEditor api={api} profile={profile.value} />
        </Tabs.Panel>
        <Tabs.Panel className="flex flex-col gap-3 p-0 pt-3" id="progress">
          {reports.value.length > 0 ? (
            <>
              {monthly.length > 0 && <MonthlyDynamics reports={monthly} />}
              {weekly.length > 0 && <Dynamics reports={weekly} />}
              <div className="flex flex-col gap-2">
                {reports.value.map((r) => (
                  <Button
                    key={r.id}
                    variant="primary"
                    className="w-full"
                    onPress={() => go({ name: 'report', id: r.id })}
                  >
                    {reportTitle(r)}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Notice>Отправленных отчётов пока нет</Notice>
          )}
        </Tabs.Panel>
      </Tabs>
    </>
  )
}
