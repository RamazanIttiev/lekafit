export type WebAppButton = { text: string; url: string }

export type SentMessage = { chatId: number; text: string; webAppButton?: WebAppButton }

export interface TelegramGateway {
  send(message: SentMessage): Promise<void>
}

export const TELEGRAM = Symbol('TELEGRAM')
