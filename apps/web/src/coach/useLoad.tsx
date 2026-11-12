import { type ReactNode, useEffect, useState } from 'react'
import { Notice } from '../components/Notice'

export const useLoad = <T,>(load: () => Promise<T>) => {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load().then(setValue, (e: Error) => setError(e.message))
  }, [load])
  return { value, error }
}

export const Loading = ({ error, children }: { error: string | null; children: ReactNode }) =>
  error ? <Notice status="danger">{error}</Notice> : children
