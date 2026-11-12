import { useCallback, useState } from 'react'
import type { CoachApi } from '../api'
import { useBackButton } from '../hooks/useBackButton'
import type { BackButton } from '../telegram'
import { Client } from './components/Client'
import { Clients } from './components/Clients'
import { ReportView } from './components/ReportView'
import { parseRoute, type Route } from './route'

export const CoachApp = ({
  api,
  initialRoute,
  backButton,
  share,
}: {
  api: CoachApi
  initialRoute: string
  backButton: BackButton
  share: (url: string, text: string) => void
}) => {
  const [route, setRoute] = useState<Route>(parseRoute(initialRoute))
  const toClients = useCallback(() => setRoute({ name: 'clients' }), [])
  useBackButton(backButton, route.name === 'client' ? toClients : null)
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-3">
      {route.name === 'clients' && <Clients api={api} go={setRoute} share={share} />}
      {route.name === 'client' && <Client key={route.id} api={api} id={route.id} go={setRoute} />}
      {route.name === 'report' && (
        <ReportView key={route.id} api={api} id={route.id} backButton={backButton} go={setRoute} />
      )}
    </main>
  )
}
