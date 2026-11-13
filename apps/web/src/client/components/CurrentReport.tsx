import { Alert, Button, Chip } from '@heroui/react'
import {
  missingFields,
  missingPhotos,
  monthlyMissingFields,
  type PhotoAngle,
} from '@lekafit/shared'
import { useCallback, useEffect, useState } from 'react'
import type { Api, MonthlyReportData, Report, ReportData } from '../../api'
import { CenteredSpinner } from '../../components/CenteredSpinner'
import { Notice } from '../../components/Notice'
import { period } from '../../lib/format'
import { resizeImage } from '../../lib/resize-image'
import { MonthlyReportForm } from '../../report/MonthlyReportForm'
import { PhotoSlots } from '../../report/PhotoSlots'
import { ReportForm } from '../../report/ReportForm'
import { type SaveStatus, useAutosave } from '../../report/useAutosave'
import { hapticSuccess } from '../../telegram'

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Сохраняю…',
  saved: 'Сохранено',
  error: 'Не сохранилось — проверьте интернет',
}

const CONFIRM_MESSAGE = 'Отправить отчёт тренеру? После отправки изменить его будет нельзя.'
const ERROR_VISIBLE_MS = 3000

const missingIn = (report: Report) =>
  report.kind === 'WEEKLY'
    ? missingFields(report.data)
    : [...monthlyMissingFields(report.data), ...missingPhotos(report.photos)]

const title = (report: Report) => period(report)

type Props = {
  api: Api
  confirm: (message: string) => Promise<boolean>
  load: () => Promise<Report>
}

export const CurrentReport = ({ api, confirm, load }: Props) => {
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
    load().then(setReport, (e: Error) => setError(e.message))
  }, [load])

  const reportId = report?.id
  const save = useCallback(
    (data: ReportData | MonthlyReportData) =>
      reportId === undefined ? Promise.resolve() : api.saveReport(reportId, data),
    [api, reportId],
  )
  const autosave = useAutosave(save)

  if (error)
    return (
      <Notice status="danger" indicator>
        {error}
      </Notice>
    )
  if (!report) return <CenteredSpinner />

  const readOnly = report.submittedAt !== null || sending

  const onWeeklyChange = (data: ReportData) => {
    if (report.kind === 'WEEKLY') setReport({ ...report, data })
    autosave.schedule(data)
  }

  const onMonthlyChange = (data: MonthlyReportData) => {
    if (report.kind === 'MONTHLY') setReport({ ...report, data })
    autosave.schedule(data)
  }

  const keepPhotos = (updated: { photos: Record<PhotoAngle, boolean> }) =>
    setReport((current) =>
      current?.kind === 'MONTHLY' ? { ...current, photos: updated.photos } : current,
    )

  const pickPhoto = async (angle: PhotoAngle, file: File) =>
    keepPhotos(await api.uploadPhoto(report.id, angle, await resizeImage(file)))

  const removePhoto = async (angle: PhotoAngle) =>
    keepPhotos(await api.removePhoto(report.id, angle))

  const submit = async () => {
    const missing = missingIn(report)
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
        <h1>{title(report)}</h1>
        {report.submittedAt === null && autosave.status !== 'idle' && (
          <Chip size="sm" color={autosave.status === 'error' ? 'danger' : 'default'}>
            {SAVE_LABEL[autosave.status]}
          </Chip>
        )}
      </div>
      {report.submittedAt !== null && (
        <Notice status="success" indicator>
          Отчёт отправлен тренеру
        </Notice>
      )}
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
      {report.submittedAt === null && report.kind === 'WEEKLY' && (
        <ReportForm
          data={report.data}
          plan={report.plan}
          readOnly={readOnly}
          invalid={invalid}
          onChange={onWeeklyChange}
        />
      )}
      {report.submittedAt === null && report.kind === 'MONTHLY' && (
        <MonthlyReportForm
          data={report.data}
          plan={report.plan}
          readOnly={readOnly}
          invalid={invalid}
          onChange={onMonthlyChange}
          photos={
            <PhotoSlots
              reportId={report.id}
              photos={report.photos}
              prevReportId={report.prevPhotosReportId}
              load={api.photo}
              readOnly={readOnly}
              isInvalid={(path) => invalid.has(path)}
              onPick={pickPhoto}
              onRemove={removePhoto}
            />
          }
        />
      )}
      {report.submittedAt === null && (
        <Button fullWidth size="lg" isDisabled={sending} onPress={submit}>
          Отправить тренеру
        </Button>
      )}
    </>
  )
}
