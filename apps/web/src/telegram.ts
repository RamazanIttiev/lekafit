type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
  showConfirm: (message: string, callback: (ok: boolean) => void) => void
  HapticFeedback?: { notificationOccurred: (type: 'success' | 'error' | 'warning') => void }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  initDataUnsafe?: { start_param?: string }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const webApp = (): TelegramWebApp | undefined => window.Telegram?.WebApp

export const confirmWithTelegram = (message: string): Promise<boolean> => {
  const tg = webApp()
  if (!tg?.initData) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => tg.showConfirm(message, resolve))
}

export const hapticSuccess = () => webApp()?.HapticFeedback?.notificationOccurred('success')
