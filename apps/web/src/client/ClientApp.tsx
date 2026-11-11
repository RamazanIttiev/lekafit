import { Button, Chip, Spinner } from '@heroui/react'
import { missingRequiredFields } from '@lekafit/shared'
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

const confirmMessage = (data: ReportData) => {
  const missing = missingRequiredFields(data)
  const base = 'Отправить отчёт тренеру? После отправки изменить его будет нельзя.'
  return missing.length ? `${base}\n\nНе заполнено: ${missing.join(', ')}.` : base
}

const SentBanner = () => <p className="sent">Отчёт отправлен тренеру</p>

const CurrentReport = ({ api, confirm }: Props) => {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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

  if (error) return <p className="error">{error}</p>
  if (!report) return <Spinner className="mx-auto my-10" />

  const readOnly = report.status === 'SUBMITTED' || sending

  const onChange = (data: ReportData) => {
    setReport({ ...report, data })
    autosave.schedule(data)
  }

  const submit = async () => {
    if (!(await confirm(confirmMessage(report.data)))) return
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
        <div>
          <p className="eyebrow">Отчёт за неделю</p>
          <h1 className="title">{period(report)}</h1>
        </div>
        {report.status === 'DRAFT' && autosave.status !== 'idle' && (
          <Chip size="sm" color={autosave.status === 'error' ? 'danger' : 'default'}>
            {SAVE_LABEL[autosave.status]}
          </Chip>
        )}
      </div>
      {report.status === 'SUBMITTED' && <SentBanner />}
      <ReportForm data={report.data} plan={report.plan} readOnly={readOnly} onChange={onChange} />
      {report.status === 'DRAFT' && (
        <div className="dock">
          <Button fullWidth size="lg" isDisabled={sending} onPress={submit}>
            Отправить тренеру
          </Button>
        </div>
      )}
    </>
  )
}

const History = ({ api, onOpen }: { api: Api; onOpen: (id: number) => void }) => {
  const [reports, setReports] = useState<Report[] | null>(null)
  useEffect(() => {
    api.listReports().then(setReports)
  }, [api])
  if (!reports) return <Spinner className="mx-auto my-10" />
  if (!reports.length) return <p className="notice">Отчётов пока нет</p>
  return (
    <div className="flex flex-col gap-2">
      {reports.map((r) => (
        <Button
          key={r.id}
          variant="secondary"
          className="justify-between"
          onPress={() => onOpen(r.id)}
        >
          <span>{period(r)}</span>
          <span className="text-xs">{r.status === 'SUBMITTED' ? 'отправлен' : 'черновик'}</span>
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
  if (!report) return <Spinner className="mx-auto my-10" />
  return (
    <>
      <h1 className="title">{period(report)}</h1>
      <ReportForm data={report.data} plan={report.plan} readOnly onChange={() => undefined} />
    </>
  )
}

export const ClientApp = ({ api, confirm }: Props) => {
  const [view, setView] = useState<View>({ name: 'current' })
  return (
    <main className="wrap">
      <nav className="tabs">
        <Button
          size="sm"
          variant={view.name === 'current' ? 'primary' : 'ghost'}
          onPress={() => setView({ name: 'current' })}
        >
          Эта неделя
        </Button>
        <Button
          size="sm"
          variant={view.name === 'current' ? 'ghost' : 'primary'}
          onPress={() => setView({ name: 'history' })}
        >
          История
        </Button>
      </nav>
      {view.name === 'current' && <CurrentReport api={api} confirm={confirm} />}
      {view.name === 'history' && (
        <History api={api} onOpen={(id) => setView({ name: 'past', id })} />
      )}
      {view.name === 'past' && <PastReport api={api} id={view.id} />}
    </main>
  )
}
