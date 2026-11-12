import { Alert } from '@heroui/react'
import { useEffect, useState } from 'react'
import type { Api, CoachApi, Me } from './api'
import { ClientApp } from './client/ClientApp'
import { CoachApp } from './coach/CoachApp'
import { CenteredSpinner } from './components/CenteredSpinner'
import type { BackButton } from './telegram'

type Props = {
  api: Api
  coachApi: CoachApi
  confirm: (message: string) => Promise<boolean>
  initialRoute: string
  backButton: BackButton
  share: (url: string, text: string) => void
}

export const App = ({ api, coachApi, confirm, initialRoute, backButton, share }: Props) => {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setMe, (e: Error) => setError(e.message))
  }, [api])

  if (error)
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>{error}</Alert.Title>
        </Alert.Content>
      </Alert>
    )
  if (!me) return <CenteredSpinner />
  if (me.role === 'COACH')
    return (
      <CoachApp api={coachApi} initialRoute={initialRoute} backButton={backButton} share={share} />
    )
  return <ClientApp api={api} confirm={confirm} />
}
