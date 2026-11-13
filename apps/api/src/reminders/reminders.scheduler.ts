import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { type AppConfig, CONFIG } from '../config'
import { RemindersService } from './reminders.service'

const TICK_MS = 20_000

@Injectable()
export class RemindersScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('RemindersScheduler')
  private timer: NodeJS.Timeout | undefined

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(RemindersService) private readonly reminders: RemindersService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.startBot) return
    this.timer = setInterval(() => {
      this.reminders
        .tick()
        .catch((error) => this.logger.error(`Reminder tick failed: ${String(error)}`))
    }, TICK_MS)
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer)
  }
}
