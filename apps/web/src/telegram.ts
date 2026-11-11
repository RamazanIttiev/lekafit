import { backButton, hapticFeedback, openTelegramLink, popup } from '@tma.js/sdk-react'

export type BackButton = {
  show: () => void
  hide: () => void
  onClick: (cb: () => void) => void
  offClick: (cb: () => void) => void
}

export const sdkBackButton: BackButton = backButton

export const confirmWithTelegram = async (message: string): Promise<boolean> => {
  if (!popup.show.isAvailable()) return window.confirm(message)
  const id = await popup.show({
    message,
    buttons: [
      { id: 'ok', type: 'ok' },
      { id: 'cancel', type: 'cancel' },
    ],
  })
  return id === 'ok'
}

export const shareWithTelegram = (url: string, text: string) => {
  const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  if (openTelegramLink.isAvailable()) openTelegramLink(link)
  else window.open(link, '_blank')
}

export const hapticSuccess = () => {
  if (hapticFeedback.notificationOccurred.isAvailable())
    hapticFeedback.notificationOccurred('success')
}
