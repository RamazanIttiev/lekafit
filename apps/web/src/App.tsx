import { Spinner } from '@heroui/react'
import { useEffect, useState } from 'react'
import type { Api, Me } from './api'
import { ClientApp } from './client/ClientApp'

type Props = { api: Api; confirm: (message: string) => Promise<boolean> }

export const App = ({ api, confirm }: Props) => {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setMe, (e: Error) => setError(e.message))
  }, [api])

  if (error) return <p className="wrap error">{error}</p>
  if (!me) return <Spinner className="mx-auto my-10" />
  return <ClientApp api={api} confirm={confirm} />
}
