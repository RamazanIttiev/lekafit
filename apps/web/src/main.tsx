import { retrieveRawInitData } from '@tma.js/sdk-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { blobClient, createApi, createCoachApi, httpClient } from './api'
import { clientTabFromLocation } from './client/tab'
import { routeFromLocation } from './coach/route'
import { ensureTelegramLaunchParams } from './lib/ensure-telegram-launch-params'
import { initTma } from './lib/tma-sdk'
import {
  confirmWithTelegram,
  downloadWithTelegram,
  sdkBackButton,
  shareWithTelegram,
} from './telegram'
import './index.css'

const root = document.getElementById('root')

if (!root) throw new Error('Missing #root element')

const start = async (container: HTMLElement) => {
  const launchParams = ensureTelegramLaunchParams()
  const debug = (launchParams.tgWebAppStartParam ?? '').includes('debug') || import.meta.env.DEV
  await initTma({ debug })

  const connection = {
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    initData: retrieveRawInitData() ?? '',
  }
  const request = httpClient(connection)
  const fetchBlob = blobClient(connection)

  createRoot(container).render(
    <StrictMode>
      <App
        api={createApi(request, fetchBlob)}
        coachApi={createCoachApi(request, fetchBlob)}
        confirm={confirmWithTelegram}
        initialRoute={routeFromLocation(window.location)}
        initialTab={clientTabFromLocation(window.location)}
        backButton={sdkBackButton}
        share={shareWithTelegram}
        download={downloadWithTelegram}
      />
    </StrictMode>,
  )
}

start(root).catch((error: unknown) => {
  console.error('[TMA bootstrap]', error)
  root.textContent = 'Откройте отчёт через бота LekaFit в Telegram.'
})
