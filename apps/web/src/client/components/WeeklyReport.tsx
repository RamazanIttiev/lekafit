import { ListBox, Select } from '@heroui/react'
import { useCallback, useState } from 'react'
import type { Api } from '../../api'
import { CurrentReport } from './CurrentReport'

type Week = 'current' | 'previous'

const WEEKS: readonly { key: Week; label: string }[] = [
  { key: 'current', label: 'Текущая неделя' },
  { key: 'previous', label: 'Прошлая неделя' },
]

type Props = { api: Api; confirm: (message: string) => Promise<boolean> }

export const WeeklyReport = ({ api, confirm }: Props) => {
  const [week, setWeek] = useState<Week>('current')
  const load = useCallback(
    () => api.currentReport(week === 'previous' ? 'previous' : undefined),
    [api, week],
  )

  return (
    <>
      <Select
        aria-label="Неделя отчёта"
        selectedKey={week}
        onSelectionChange={(key) => setWeek(WEEKS.find((w) => w.key === key)?.key ?? 'current')}
      >
        <Select.Trigger className={'bg-surface'}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {WEEKS.map((w) => (
              <ListBox.Item key={w.key} id={w.key} textValue={w.label}>
                {w.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <CurrentReport key={week} api={api} confirm={confirm} load={load} />
    </>
  )
}
