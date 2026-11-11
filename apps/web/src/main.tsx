import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createApi, createCoachApi, httpClient } from './api'
import { applyTelegramTheme, confirmWithTelegram, shareWithTelegram, webApp } from './telegram'
import 'tailwindcss/index.css'
import '@heroui/react/styles'

const root = document.getElementById('root')
const tg = webApp()

if (root && tg?.initData) {
  applyTelegramTheme(tg)
  tg.onEvent?.('themeChanged', () => applyTelegramTheme(tg))
  tg.ready()
  tg.expand()
  const request = httpClient({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    initData: tg.initData,
  })
  createRoot(root).render(
    <StrictMode>
      <App
        api={createApi(request)}
        coachApi={createCoachApi(request)}
        confirm={confirmWithTelegram}
        initialRoute={window.location.hash}
        backButton={tg.BackButton}
        share={shareWithTelegram}
      />
    </StrictMode>,
  )
} else if (root) {
  root.textContent = 'Откройте отчёт через бота LekaFit в Telegram.'
}
