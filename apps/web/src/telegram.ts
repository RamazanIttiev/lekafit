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
  colorScheme?: 'light' | 'dark'
  themeParams?: ThemeParams
  onEvent?: (event: 'themeChanged', cb: () => void) => void
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

type ThemeParams = Partial<
  Record<
    | 'bg_color'
    | 'secondary_bg_color'
    | 'section_bg_color'
    | 'text_color'
    | 'hint_color'
    | 'button_color'
    | 'button_text_color'
    | 'destructive_text_color'
    | 'section_separator_color',
    string
  >
>

const TOKENS: ReadonlyArray<[string, keyof ThemeParams]> = [
  ['--background', 'secondary_bg_color'],
  ['--foreground', 'text_color'],
  ['--surface', 'section_bg_color'],
  ['--surface-foreground', 'text_color'],
  ['--overlay', 'bg_color'],
  ['--overlay-foreground', 'text_color'],
  ['--field-background', 'bg_color'],
  ['--field-foreground', 'text_color'],
  ['--field-placeholder', 'hint_color'],
  ['--muted', 'hint_color'],
  ['--accent', 'button_color'],
  ['--accent-foreground', 'button_text_color'],
  ['--focus', 'button_color'],
  ['--danger', 'destructive_text_color'],
  ['--separator', 'section_separator_color'],
  ['--border', 'section_separator_color'],
]

export const applyTelegramTheme = (tg: {
  colorScheme?: 'light' | 'dark'
  themeParams?: ThemeParams
}) => {
  const root = document.documentElement
  root.dataset.theme = tg.colorScheme ?? 'light'
  TOKENS.forEach(([token, param]) => {
    const color = tg.themeParams?.[param]
    if (color) root.style.setProperty(token, color)
  })
}
