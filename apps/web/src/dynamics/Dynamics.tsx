import { Card, Table } from '@heroui/react'
import type { WeeklyReport } from '../api'
import { shortDate } from '../lib/format'

const COLUMNS = ['Неделя', 'Вес', 'Талия', 'Ккал', 'Шаги'] as const

export const Dynamics = ({ reports }: { reports: WeeklyReport[] }) => (
  <Card>
    <Card.Header>
      <Card.Title>Динамика</Card.Title>
    </Card.Header>
    <Table className="bg-transparent shadow-none [&_.table__cell]:bg-transparent [&_.table__header]:bg-transparent [&_.table__column]:bg-transparent [&_.table__row]:bg-transparent [&_.table__body]:bg-transparent">
      <Table.ScrollContainer>
        <Table.Content aria-label="Динамика">
          <Table.Header className="bg-transparent">
            {COLUMNS.map((c, i) => (
              <Table.Column key={c} isRowHeader={i === 0}>
                {c}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {reports.map((r) => (
              <Table.Row key={r.id} className="[&_.table__cell]:bg-transparent!">
                <Table.Cell>{shortDate(r.weekStart)}</Table.Cell>
                <Table.Cell>{r.data.now.weight || '—'}</Table.Cell>
                <Table.Cell>{r.data.now.waist || '—'}</Table.Cell>
                <Table.Cell>{r.data.fact.cal || '—'}</Table.Cell>
                <Table.Cell>{r.data.fact.steps || '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  </Card>
)
