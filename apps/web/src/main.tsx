import { retrieveRawInitData } from '@tma.js/sdk-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createApi, createCoachApi, httpClient } from './api'
import { routeFromLocation } from './coach/route'
import { ensureTelegramLaunchParams } from './lib/ensure-telegram-launch-params'
import { initTma } from './lib/tma-sdk'
import { confirmWithTelegram, sdkBackButton, shareWithTelegram } from './telegram'
import './index.css'

const root = document.getElementById('root')

if (!root) throw new Error('Missing #root element')

const start = async (container: HTMLElement) => {
  const launchParams = ensureTelegramLaunchParams()
  const debug = (launchParams.tgWebAppStartParam ?? '').includes('debug') || import.meta.env.DEV
  await initTma({ debug })

  const request = httpClient({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    initData: retrieveRawInitData() ?? '',
  })

  createRoot(container).render(
    <StrictMode>
      <App
        api={createApi(request)}
        coachApi={createCoachApi(request)}
        confirm={confirmWithTelegram}
        initialRoute={routeFromLocation(window.location)}
        backButton={sdkBackButton}
        share={shareWithTelegram}
      />
    </StrictMode>,
  )
}

start(root).catch((error: unknown) => {
  console.error('[TMA bootstrap]', error)
  root.textContent = 'Откройте отчёт через бота LekaFit в Telegram.'
})
