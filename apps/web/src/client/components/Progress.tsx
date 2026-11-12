import { useEffect, useState } from 'react'
import type { Api } from '../../api'
import { CenteredSpinner } from '../../components/CenteredSpinner'
import { Notice } from '../../components/Notice'
import { Dynamics } from '../../dynamics/Dynamics'
import { MonthlyDynamics } from '../../dynamics/MonthlyDynamics'

const useList = <T,>(load: () => Promise<T[]>) => {
  const [items, setItems] = useState<T[] | null>(null)
  useEffect(() => {
    load().then(setItems)
  }, [load])
  return items
}

export const Progress = ({ api }: { api: Api }) => {
  const weekly = useList(api.listReports)
  const monthly = useList(api.listMonthlyReports)
  if (!weekly || !monthly) return <CenteredSpinner />
  if (!weekly.length && !monthly.length) return <Notice indicator>Отчётов пока нет</Notice>
  return (
    <>
      {monthly.length > 0 && <MonthlyDynamics reports={monthly} />}
      {weekly.length > 0 && <Dynamics reports={weekly} />}
    </>
  )
}
