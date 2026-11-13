import { Card, Table } from '@heroui/react'
import { formatDelta, parseNumber } from '@lekafit/shared'
import type { MonthlyReport } from '../api'
import { period } from '../lib/format'

const COLUMNS = ['Период', 'Вес', 'Δ от старта', 'Талия'] as const

export const MonthlyDynamics = ({ reports }: { reports: MonthlyReport[] }) => (
  <Card>
    <Card.Header>
      <Card.Title>Динамика по месяцам</Card.Title>
    </Card.Header>
    <Table className="bg-transparent shadow-none [&_.table__cell]:bg-transparent [&_.table__header]:bg-transparent [&_.table__column]:bg-transparent [&_.table__row]:bg-transparent [&_.table__body]:bg-transparent">
      <Table.ScrollContainer>
        <Table.Content aria-label="Динамика по месяцам">
          <Table.Header className="bg-transparent">
            {COLUMNS.map((c, i) => (
              <Table.Column key={c} isRowHeader={i === 0} className={'text-center p-1'}>
                {c}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {reports.map((r) => (
              <Table.Row key={r.id} className="[&_.table__cell]:bg-transparent!">
                <Table.Cell className={''}>{period(r)}</Table.Cell>
                <Table.Cell className={'text-center'}>{r.data.now.weight || '—'}</Table.Cell>
                <Table.Cell className={'text-center'}>
                  {formatDelta({
                    from: parseNumber(r.data.baseline.weight),
                    to: parseNumber(r.data.now.weight),
                    unit: 'кг',
                  })}
                </Table.Cell>
                <Table.Cell className={'text-center'}>{r.data.now.waist || '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  </Card>
)
