import { Button, Card, Chip, Spinner } from '@heroui/react'
import { METRICS, type MetricKey, parseNumber } from '@lekafit/shared'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { ClientListItem, ClientProfile, CoachApi, CoachReport, Plan, Report } from '../api'
import { period, shortDate } from '../format'
import { ReportForm } from '../report/ReportForm'

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
  error ? <p className="error">{error}</p> : children

const Clients = ({ api, go }: { api: CoachApi; go: (r: Route) => void }) => {
  const { value: clients, error } = useLoad(useCallback(() => api.clients(), [api]))
  if (!clients)
    return (
      <Loading error={error}>
        <Spinner className="mx-auto my-10" />
      </Loading>
    )
  if (!clients.length)
    return (
      <p className="notice">
        Клиентов пока нет. Отправьте клиентам ссылку на бота — после команды /start они появятся
        здесь.
      </p>
    )
  return (
    <div className="flex flex-col gap-2">
      {clients.map((c: ClientListItem) => (
        <Button
          key={c.id}
          variant="secondary"
          className="client-row"
          onPress={() => go({ name: 'client', id: c.id })}
        >
          <span className="font-bold">{fullName(c)}</span>
          <span className="text-xs">
            {c.lastReportWeek ? `последний: ${shortDate(c.lastReportWeek)}` : 'отчётов нет'}
          </span>
          {c.unseenReports > 0 && (
            <Chip size="sm" color="accent">
              новых: {c.unseenReports}
            </Chip>
          )}
        </Button>
      ))}
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

  const save = async () => {
    const invalid = METRICS.filter(
      (m) => values[m.key].trim() && parseNumber(values[m.key]) === null,
    )
    if (invalid.length) {
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
      setMessage('План сохранён')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <Card className="section">
      <Card.Header>
        <Card.Title className="section-title">План</Card.Title>
        <Card.Description className="text-xs text-muted">
          Клиент видит его в отчёте
        </Card.Description>
      </Card.Header>
      <Card.Content className="plan-grid">
        {METRICS.map((m) => (
          <label key={m.key} className="field">
            <span>
              {m.label}{' '}
              <small className="text-muted">
                {m.unit} / {m.scope}
              </small>
            </span>
            <input
              className="num-input"
              aria-label={`План ${m.label}`}
              inputMode="decimal"
              placeholder="—"
              value={values[m.key]}
              onChange={(e) => setValues({ ...values, [m.key]: e.target.value })}
            />
          </label>
        ))}
      </Card.Content>
      <Card.Footer className="flex flex-col items-stretch gap-2">
        <Button onPress={save}>Сохранить план</Button>
        {message && <p className="text-sm text-center m-0">{message}</p>}
      </Card.Footer>
    </Card>
  )
}

const Progress = ({ reports }: { reports: Report[] }) => (
  <Card className="section">
    <Card.Header>
      <Card.Title className="section-title">Динамика</Card.Title>
    </Card.Header>
    <Card.Content className="overflow-x-auto">
      <table className="progress" aria-label="Динамика">
        <thead>
          <tr>
            <th>Неделя</th>
            <th>Вес</th>
            <th>Талия</th>
            <th>Ккал</th>
            <th>Шаги</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{shortDate(r.weekStart)}</td>
              <td>{r.data.now.weight || '—'}</td>
              <td>{r.data.now.waist || '—'}</td>
              <td>{r.data.fact.cal || '—'}</td>
              <td>{r.data.fact.steps || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card.Content>
  </Card>
)

const Client = ({ api, id, go }: { api: CoachApi; id: number; go: (r: Route) => void }) => {
  const profile = useLoad(useCallback(() => api.client(id), [api, id]))
  const reports = useLoad(useCallback(() => api.clientReports(id), [api, id]))
  if (!profile.value || !reports.value)
    return (
      <Loading error={profile.error ?? reports.error}>
        <Spinner className="mx-auto my-10" />
      </Loading>
    )
  return (
    <>
      <h1 className="title">{fullName(profile.value)}</h1>
      <PlanEditor api={api} profile={profile.value} />
      {reports.value.length > 0 ? (
        <>
          <Progress reports={reports.value} />
          <div className="flex flex-col gap-2">
            {reports.value.map((r) => (
              <Button
                key={r.id}
                variant="secondary"
                onPress={() => go({ name: 'report', id: r.id })}
              >
                Отчёт {period(r)}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="notice">Отправленных отчётов пока нет</p>
      )}
    </>
  )
}

const ReportView = ({ api, id }: { api: CoachApi; id: number }) => {
  const { value: report, error } = useLoad<CoachReport>(
    useCallback(() => api.report(id), [api, id]),
  )
  if (!report)
    return (
      <Loading error={error}>
        <Spinner className="mx-auto my-10" />
      </Loading>
    )
  return (
    <>
      <div>
        <p className="eyebrow">Отчёт {period(report)}</p>
        <h1 className="title">{fullName(report.client)}</h1>
      </div>
      <ReportForm data={report.data} plan={report.plan} readOnly onChange={() => undefined} />
    </>
  )
}

export const CoachApp = ({ api, initialRoute }: { api: CoachApi; initialRoute: string }) => {
  const [route, setRoute] = useState<Route>(parseRoute(initialRoute))
  return (
    <main className="wrap">
      {route.name !== 'clients' && (
        <nav className="tabs">
          <Button size="sm" variant="ghost" onPress={() => setRoute({ name: 'clients' })}>
            Все клиенты
          </Button>
        </nav>
      )}
      {route.name === 'clients' && <Clients api={api} go={setRoute} />}
      {route.name === 'client' && <Client key={route.id} api={api} id={route.id} go={setRoute} />}
      {route.name === 'report' && <ReportView key={route.id} api={api} id={route.id} />}
    </main>
  )
}
