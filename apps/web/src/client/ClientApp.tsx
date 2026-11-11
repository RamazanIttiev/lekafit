import { Alert, Button, Chip, Spinner, Tabs } from '@heroui/react'
import { missingFields } from '@lekafit/shared'
import { useCallback, useEffect, useState } from 'react'
import type { Api, Report, ReportData } from '../api'
import { Dynamics } from '../Dynamics'
import { period } from '../format'
import { ReportForm } from '../report/ReportForm'
import { type SaveStatus, useAutosave } from '../report/useAutosave'
import { hapticSuccess } from '../telegram'

type Props = { api: Api; confirm: (message: string) => Promise<boolean> }

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

const Progress = ({ api }: { api: Api }) => {
  const [reports, setReports] = useState<Report[] | null>(null)
  useEffect(() => {
    api.listReports().then(setReports)
  }, [api])
  if (!reports) return <Spinner />
  if (!reports.length) return <Notice>Отчётов пока нет</Notice>
  return <Dynamics reports={reports} />
}

export const ClientApp = ({ api, confirm }: Props) => (
  <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
    <Tabs variant="primary">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Отчёты">
          <Tabs.Tab id="current">
            Эта неделя
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="progress">
            Прогресс
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="current" className="flex flex-col gap-3">
        <CurrentReport api={api} confirm={confirm} />
      </Tabs.Panel>
      <Tabs.Panel id="progress" className="flex flex-col gap-3">
        <Progress api={api} />
      </Tabs.Panel>
    </Tabs>
  </main>
)
