import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Tabs,
  TextField,
} from '@heroui/react'
import { METRICS, type MetricKey, parseNumber } from '@lekafit/shared'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { ClientListItem, ClientProfile, CoachApi, CoachReport, Plan } from '../api'
import { CenteredSpinner } from '../CenteredSpinner'
import { Dynamics } from '../Dynamics'
import { period, shortDate } from '../format'
import { ReportForm } from '../report/ReportForm'
import type { BackButton } from '../telegram'
import { useBackButton } from '../useBackButton'

export type Route =
  | { name: 'clients' }
  | { name: 'client'; id: number }
  | { name: 'report'; id: number }

export const parseRoute = (hash: string): Route => {
  const client = hash.match(/^#\/coach\/clients\/(\d+)$/)
  if (client?.[1]) return { name: 'client', id: Number(client[1]) }
  const report = hash.match(/^#\/coach\/reports\/(\d+)$/)
  if (report?.[1]) return { name: 'report', id: Number(report[1]) }
  return { name: 'clients' }
}

export const routeFromLocation = ({ search, hash }: { search: string; hash: string }): string => {
  const report = new URLSearchParams(search).get('report')
  return report && /^\d+$/.test(report) ? `#/coach/reports/${report}` : hash
}

const fullName = (c: { firstName: string; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ')

const useLoad = <T,>(load: () => Promise<T>) => {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load().then(setValue, (e: Error) => setError(e.message))
  }, [load])
  return { value, error }
}

const Loading = ({ error, children }: { error: string | null; children: ReactNode }) =>
  error ? <Notice status="danger">{error}</Notice> : children

const Notice = ({ status, children }: { status?: 'danger' | 'success'; children: string }) => (
  <Alert status={status}>
    <Alert.Content>
      <Alert.Title>{children}</Alert.Title>
    </Alert.Content>
  </Alert>
)

const INVITE_TEXT = 'Привет! Это LekaFit — здесь вы будете заполнять недельный отчёт для тренера.'

const InviteButton = ({
  api,
  share,
}: {
  api: CoachApi
  share: (url: string, text: string) => void
}) => {
  const [error, setError] = useState<string | null>(null)
  const invite = async () => {
    try {
      const { url } = await api.invite()
      setError(null)
      share(url, INVITE_TEXT)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось получить ссылку')
    }
  }
  return (
    <>
      <Button fullWidth onPress={invite}>
        Добавить клиента
      </Button>
      {error && <Notice status="danger">{error}</Notice>}
    </>
  )
}

const Clients = ({
  api,
  go,
  share,
}: {
  api: CoachApi
  go: (r: Route) => void
  share: (url: string, text: string) => void
}) => {
  const { value: clients, error } = useLoad(useCallback(() => api.clients(), [api]))
  if (!clients)
    return (
      <Loading error={error}>
        <CenteredSpinner />
      </Loading>
    )
  if (!clients.length)
    return (
      <div className="flex flex-col gap-3">
        <Notice>
          Клиентов пока нет. Нажмите «Добавить клиента» и отправьте ссылку — после команды /start
          человек появится здесь.
        </Notice>
        <InviteButton api={api} share={share} />
      </div>
    )
  return (
    <div className="flex flex-col gap-2">
      <InviteButton api={api} share={share} />
      <Card className={'p-2'}>
        <Card.Content className="flex flex-col gap-1">
          {clients.map((c: ClientListItem) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl p-1 text-left hover:bg-surface-secondary"
              onClick={() => go({ name: 'client', id: c.id })}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default text-sm font-medium">
                {c.firstName.slice(0, 1)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{fullName(c)}</span>
                <span className="text-sm text-muted">
                  {c.lastReportWeek ? `последний: ${shortDate(c.lastReportWeek)}` : 'отчётов нет'}
                </span>
              </span>
              {c.unseenReports > 0 && (
                <Chip size="sm" color="accent">
                  новых: {c.unseenReports}
                </Chip>
              )}
            </button>
          ))}
        </Card.Content>
      </Card>
    </div>
  )
}

const asText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

const planToText = (plan: Plan | null): Record<MetricKey, string> => ({
  cal: asText(plan?.cal),
  protein: asText(plan?.protein),
  fat: asText(plan?.fat),
  carb: asText(plan?.carb),
  steps: asText(plan?.steps),
  training: asText(plan?.training),
})

const PlanEditor = ({ api, profile }: { api: CoachApi; profile: ClientProfile }) => {
  const [values, setValues] = useState(planToText(profile.plan))
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  const save = async () => {
    const invalid = METRICS.filter(
      (m) => values[m.key].trim() && parseNumber(values[m.key]) === null,
    )
    if (invalid.length) {
      setSaved(false)
      setMessage(`Проверьте значения: ${invalid.map((m) => m.label).join(', ')}`)
      return
    }
    const plan: Plan = {
      cal: parseNumber(values.cal),
      protein: parseNumber(values.protein),
      fat: parseNumber(values.fat),
      carb: parseNumber(values.carb),
      steps: parseNumber(values.steps),
      training: parseNumber(values.training),
    }
    try {
      await api.setPlan(profile.id, plan)
      setMessage(null)
      setSaved(true)
    } catch (e) {
      setSaved(false)
      setMessage(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>План</Card.Title>
        <Card.Description>Клиент видит его в отчёте</Card.Description>
      </Card.Header>
      <Card.Content className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <TextField
            key={m.key}
            value={values[m.key]}
            onChange={(v) => setValues({ ...values, [m.key]: v })}
          >
            <Label>{m.label}</Label>
            <Input inputMode="decimal" placeholder="—" />
            <Description>
              {m.unit} / {m.scope}
            </Description>
          </TextField>
        ))}
      </Card.Content>
      <Card.Footer className="flex flex-col gap-2">
        <Button fullWidth onPress={save}>
          Сохранить план
        </Button>
        {message && <Notice status="danger">{message}</Notice>}
        {saved && (
          <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-2xl">
            <Notice status="success">План сохранён</Notice>
          </div>
        )}
      </Card.Footer>
    </Card>
  )
}

const Client = ({ api, id, go }: { api: CoachApi; id: number; go: (r: Route) => void }) => {
  const profile = useLoad(useCallback(() => api.client(id), [api, id]))
  const reports = useLoad(useCallback(() => api.clientReports(id), [api, id]))
  if (!profile.value || !reports.value)
    return (
      <Loading error={profile.error ?? reports.error}>
        <CenteredSpinner />
      </Loading>
    )
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
              <Dynamics reports={reports.value} />
              <div className="flex flex-col gap-2">
                {reports.value.map((r) => (
                  <Button
                    key={r.id}
                    variant="primary"
                    className="w-full"
                    onPress={() => go({ name: 'report', id: r.id })}
                  >
                    Отчёт {period(r)}
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

const ReportView = ({
  api,
  id,
  backButton,
  go,
}: {
  api: CoachApi
  id: number
  backButton: BackButton
  go: (r: Route) => void
}) => {
  const { value: report, error } = useLoad<CoachReport>(
    useCallback(() => api.report(id), [api, id]),
  )
  const clientId = report?.client.id
  const back = useCallback(
    () => go(clientId === undefined ? { name: 'clients' } : { name: 'client', id: clientId }),
    [go, clientId],
  )
  useBackButton(backButton, back)
  if (!report)
    return (
      <Loading error={error}>
        <CenteredSpinner />
      </Loading>
    )
  return (
    <>
      <h1>{fullName(report.client)}</h1>
      <p>Отчёт {period(report)}</p>
      <ReportForm data={report.data} plan={report.plan} readOnly onChange={() => undefined} />
    </>
  )
}

export const CoachApp = ({
  api,
  initialRoute,
  backButton,
  share,
}: {
  api: CoachApi
  initialRoute: string
  backButton: BackButton
  share: (url: string, text: string) => void
}) => {
  const [route, setRoute] = useState<Route>(parseRoute(initialRoute))
  const toClients = useCallback(() => setRoute({ name: 'clients' }), [])
  useBackButton(backButton, route.name === 'client' ? toClients : null)
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
      {route.name === 'clients' && <Clients api={api} go={setRoute} share={share} />}
      {route.name === 'client' && <Client key={route.id} api={api} id={route.id} go={setRoute} />}
      {route.name === 'report' && (
        <ReportView key={route.id} api={api} id={route.id} backButton={backButton} go={setRoute} />
      )}
    </main>
  )
}
