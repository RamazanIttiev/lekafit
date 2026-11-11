import { Alert, Button, Chip, Spinner, Tabs } from '@heroui/react'
import { missingFields } from '@lekafit/shared'
import { useCallback, useEffect, useState } from 'react'
import type { Api, Report, ReportData } from '../api'
import { period } from '../format'
import { ReportForm } from '../report/ReportForm'
import { type SaveStatus, useAutosave } from '../report/useAutosave'
import { hapticSuccess } from '../telegram'

type Props = { api: Api; confirm: (message: string) => Promise<boolean> }

type View = { name: 'current' } | { name: 'history' } | { name: 'past'; id: number }

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Сохраняю…',
  saved: 'Сохранено',
  error: 'Не сохранилось — проверьте интернет',
}

const CONFIRM_MESSAGE = 'Отправить отчёт тренеру? После отправки изменить его будет нельзя.'
const ERROR_VISIBLE_MS = 3000

const Notice = ({ status, children }: { status?: 'success' | 'danger'; children: string }) => (
  <Alert status={status}>
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Title>{children}</Alert.Title>
    </Alert.Content>
  </Alert>
)

const CurrentReport = ({ api, confirm }: Props) => {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (invalid.size === 0) return
    const timer = setTimeout(() => setInvalid(new Set()), ERROR_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [invalid])

  useEffect(() => {
    api.currentReport().then(setReport, (e: Error) => setError(e.message))
  }, [api])

  const reportId = report?.id
  const save = useCallback(
    (data: ReportData) =>
      reportId === undefined ? Promise.resolve() : api.saveReport(reportId, data),
    [api, reportId],
  )
  const autosave = useAutosave(save)

  if (error) return <Notice status="danger">{error}</Notice>
  if (!report) return <Spinner />

  const readOnly = report.status === 'SUBMITTED' || sending

  const onChange = (data: ReportData) => {
    setReport({ ...report, data })
    autosave.schedule(data)
  }

  const submit = async () => {
    const missing = missingFields(report.data)
    if (missing.length) return setInvalid(new Set(missing))
    if (!(await confirm(CONFIRM_MESSAGE))) return
    setSending(true)
    try {
      await autosave.flush()
      setReport(await api.submitReport(report.id))
      hapticSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1>{period(report)}</h1>
        {report.status === 'DRAFT' && autosave.status !== 'idle' && (
          <Chip size="sm" color={autosave.status === 'error' ? 'danger' : 'default'}>
            {SAVE_LABEL[autosave.status]}
          </Chip>
        )}
      </div>
      {report.status === 'SUBMITTED' && <Notice status="success">Отчёт отправлен тренеру</Notice>}
      {invalid.size > 0 && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-2xl">
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Заполните все поля, чтобы отправить отчёт</Alert.Title>
            </Alert.Content>
          </Alert>
        </div>
      )}
      {report.status !== 'SUBMITTED' && (
        <ReportForm
          data={report.data}
          plan={report.plan}
          readOnly={readOnly}
          invalid={invalid}
          onChange={onChange}
        />
      )}
      {report.status === 'DRAFT' && (
        <Button fullWidth size="lg" isDisabled={sending} onPress={submit}>
          Отправить тренеру
        </Button>
      )}
    </>
  )
}

const History = ({ api, onOpen }: { api: Api; onOpen: (id: number) => void }) => {
  const [reports, setReports] = useState<Report[] | null>(null)
  useEffect(() => {
    api.listReports().then(setReports)
  }, [api])
  if (!reports) return <Spinner />
  if (!reports.length) return <Notice>Отчётов пока нет</Notice>
  return (
    <div className="flex flex-col gap-2">
      {reports.map((r) => (
        <Button key={r.id} variant="secondary" onPress={() => onOpen(r.id)}>
          {period(r)} · {r.status === 'SUBMITTED' ? 'отправлен' : 'черновик'}
        </Button>
      ))}
    </div>
  )
}

const PastReport = ({ api, id }: { api: Api; id: number }) => {
  const [report, setReport] = useState<Report | null>(null)
  useEffect(() => {
    api.getReport(id).then(setReport)
  }, [api, id])
  if (!report) return <Spinner />
  return (
    <>
      <h1>{period(report)}</h1>
      <ReportForm data={report.data} plan={report.plan} readOnly onChange={() => undefined} />
    </>
  )
}

export const ClientApp = ({ api, confirm }: Props) => {
  const [view, setView] = useState<View>({ name: 'current' })
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
      <Tabs
        selectedKey={view.name === 'current' ? 'current' : 'history'}
        onSelectionChange={(key) =>
          setView(key === 'current' ? { name: 'current' } : { name: 'history' })
        }
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Отчёты">
            <Tabs.Tab id="current">
              Эта неделя
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="history">
              История
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="current" className="flex flex-col gap-3">
          <CurrentReport api={api} confirm={confirm} />
        </Tabs.Panel>
        <Tabs.Panel id="history" className="flex flex-col gap-3">
          {view.name === 'past' ? (
            <PastReport api={api} id={view.id} />
          ) : (
            <History api={api} onOpen={(id) => setView({ name: 'past', id })} />
          )}
        </Tabs.Panel>
      </Tabs>
    </main>
  )
}
