import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { Bot, InlineKeyboard } from 'grammy'
import { type AppConfig, CONFIG } from '../config'
import type { SentMessage, TelegramGateway, WebAppButton } from './telegram.gateway'

export const startReply = (webAppUrl: string): { text: string; webAppButton: WebAppButton } => ({
  text: 'Привет! Это LekaFit 💜\n\nРаз в неделю заполняйте отчёт прямо здесь — данные сохраняются автоматически, а тренер получит его сразу после отправки.',
  webAppButton: { text: '📋 Недельный отчёт', url: webAppUrl },
})

const keyboard = (button?: WebAppButton) =>
  button ? { reply_markup: new InlineKeyboard().webApp(button.text, button.url) } : {}

@Injectable()
export class GrammyGateway
  implements TelegramGateway, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('Bot')
  private readonly bot: Bot

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.bot = new Bot(config.botToken)
    this.bot.command('start', (ctx) => {
      const reply = startReply(config.webAppUrl)
      return ctx.reply(reply.text, keyboard(reply.webAppButton))
    })
    this.bot.catch((err) => this.logger.error(err.message))
  }

  async send(message: SentMessage): Promise<void> {
    await this.bot.api.sendMessage(message.chatId, message.text, keyboard(message.webAppButton))
  }

  async botUsername(): Promise<string> {
    return (await this.bot.api.getMe()).username
  }

  async onApplicationBootstrap() {
    if (!this.config.startBot) return
    await this.bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Отчёт', web_app: { url: this.config.webAppUrl } },
    })
    this.bot.start({ drop_pending_updates: true }).catch((e: Error) => this.logger.error(e.message))
  }

  async onApplicationShutdown() {
    if (this.bot.isRunning()) await this.bot.stop()
  }
}
