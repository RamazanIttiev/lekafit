import { useCallback } from 'react'
import type { CoachApi, CoachReport } from '../../api'
import { CenteredSpinner } from '../../components/CenteredSpinner'
import { useBackButton } from '../../hooks/useBackButton'
import { MonthlyReportForm } from '../../report/MonthlyReportForm'
import { ReportForm } from '../../report/ReportForm'
import type { BackButton } from '../../telegram'
import { fullName, reportTitle } from '../labels'
import type { Route } from '../route'
import { Loading, useLoad } from '../useLoad'

export const ReportView = ({
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
      <p>{reportTitle(report)}</p>
      {report.kind === 'WEEKLY' ? (
        <ReportForm data={report.data} plan={report.plan} readOnly onChange={() => undefined} />
      ) : (
        <MonthlyReportForm
          data={report.data}
          plan={report.plan}
          readOnly
          onChange={() => undefined}
        />
      )}
    </>
  )
}
