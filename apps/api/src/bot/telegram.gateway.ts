export type WebAppButton = { text: string; url: string }

export type SentMessage = { chatId: number; text: string; webAppButton?: WebAppButton }

export interface TelegramGateway {
  send(message: SentMessage): Promise<void>
  botUsername(): Promise<string>
}

export const TELEGRAM = Symbol('TELEGRAM')
