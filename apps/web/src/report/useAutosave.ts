import type { ReportData } from '@lekafit/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 600

export const useAutosave = (save: (data: ReportData) => Promise<unknown>) => {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const pending = useRef<ReportData | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const data = pending.current
    if (!data) return
    pending.current = null
    setStatus('saving')
    try {
      await save(data)
      setStatus(pending.current ? 'saving' : 'saved')
    } catch (error) {
      pending.current = pending.current ?? data
      setStatus('error')
      throw error
    }
  }, [save])

  const schedule = useCallback(
    (data: ReportData) => {
      pending.current = data
      setStatus('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        flush().catch(() => undefined)
      }, DEBOUNCE_MS)
    },
    [flush],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      clearTimeout(timer.current)
    }
  }, [flush])

  return { status, schedule, flush }
}
