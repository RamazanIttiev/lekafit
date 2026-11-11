import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createApi, httpClient } from './api'
import { confirmWithTelegram, webApp } from './telegram'
import './styles.css'

const root = document.getElementById('root')
const tg = webApp()

if (root && tg?.initData) {
  tg.ready()
  tg.expand()
  const api = createApi(
    httpClient({ baseUrl: import.meta.env.VITE_API_URL ?? '/api', initData: tg.initData }),
  )
  createRoot(root).render(
    <StrictMode>
      <App api={api} confirm={confirmWithTelegram} />
    </StrictMode>,
  )
} else if (root) {
  root.innerHTML = '<p class="wrap">Откройте отчёт через бота LekaFit в Telegram.</p>'
}
