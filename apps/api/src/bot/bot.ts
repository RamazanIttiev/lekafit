import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { Bot, InlineKeyboard } from 'grammy'
import { type AppConfig, CONFIG } from '../config'
import { reportTabUrl } from './report-tab-url'
import type { SentMessage, TelegramGateway, WebAppButton } from './telegram.gateway'

export const startReply = (webAppUrl: string): { text: string; webAppButtons: WebAppButton[] } => ({
  text: 'Привет! Это LekaFit 💜\n\nЗаполняйте отчёты прямо здесь — данные сохраняются автоматически, а я получу их сразу после отправки.',
  webAppButtons: [
    { text: '📋 Недельный отчёт', url: reportTabUrl(webAppUrl, 'week') },
    { text: '📅 Месячный отчёт', url: reportTabUrl(webAppUrl, 'month') },
  ],
})

const keyboard = (buttons: WebAppButton[]) =>
  buttons.length === 0
    ? {}
    : {
        reply_markup: buttons.reduce(
          (rows, b) => rows.row().webApp(b.text, b.url),
          new InlineKeyboard(),
        ),
      }

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
      return ctx.reply(reply.text, keyboard(reply.webAppButtons))
    })
    this.bot.catch((err) => this.logger.error(err.message))
  }

  async send(message: SentMessage): Promise<void> {
    await this.bot.api.sendMessage(
      message.chatId,
      message.text,
      keyboard(message.webAppButton ? [message.webAppButton] : []),
    )
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
