import { Card, Chip } from '@heroui/react'
import { useCallback } from 'react'
import type { ClientListItem, CoachApi } from '../../api'
import { CenteredSpinner } from '../../components/CenteredSpinner'
import { Notice } from '../../components/Notice'
import { shortDate } from '../../lib/format'
import { fullName } from '../labels'
import type { Route } from '../route'
import { Loading, useLoad } from '../useLoad'
import { InviteButton } from './InviteButton'

export const Clients = ({
  api,
  go,
  share,
}: {
  api: CoachApi
  go: (r: Route) => void
  share: (url: string, text: string) => void
}) => {
  const { value: clients, error } = useLoad(useCallback(() => api.clients(), [api]))
  if (!clients)
    return (
      <Loading error={error}>
        <CenteredSpinner />
      </Loading>
    )
  if (!clients.length)
    return (
      <div className="flex flex-col gap-3">
        <Notice>
          Клиентов пока нет. Нажмите «Добавить клиента» и отправьте ссылку — после команды /start
          человек появится здесь.
        </Notice>
        <InviteButton api={api} share={share} />
      </div>
    )
  return (
    <div className="flex flex-col gap-2">
      <InviteButton api={api} share={share} />
      <Card className={'p-2'}>
        <Card.Content className="flex flex-col gap-1">
          {clients.map((c: ClientListItem) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl p-1 text-left hover:bg-surface-secondary"
              onClick={() => go({ name: 'client', id: c.id })}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default text-sm font-medium">
                {c.firstName.slice(0, 1)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{fullName(c)}</span>
                <span className="text-sm text-muted">
                  {c.lastReportWeek ? `последний: ${shortDate(c.lastReportWeek)}` : 'отчётов нет'}
                </span>
              </span>
              {c.unseenReports > 0 && (
                <Chip size="sm" color="accent">
                  новых: {c.unseenReports}
                </Chip>
              )}
            </button>
          ))}
        </Card.Content>
      </Card>
    </div>
  )
}
