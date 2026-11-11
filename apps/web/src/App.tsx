import { Spinner } from '@heroui/react'
import { useEffect, useState } from 'react'
import type { Api, CoachApi, Me } from './api'
import { ClientApp } from './client/ClientApp'
import { CoachApp } from './coach/CoachApp'

type Props = {
  api: Api
  coachApi: CoachApi
  confirm: (message: string) => Promise<boolean>
  initialRoute: string
}

export const App = ({ api, coachApi, confirm, initialRoute }: Props) => {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setMe, (e: Error) => setError(e.message))
  }, [api])

  if (error) return <p className="wrap error">{error}</p>
  if (!me) return <Spinner className="mx-auto my-10" />
  if (me.role === 'COACH') return <CoachApp api={coachApi} initialRoute={initialRoute} />
  return <ClientApp api={api} confirm={confirm} />
}
