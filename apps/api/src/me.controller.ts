import { Controller, Get, UseGuards } from '@nestjs/common'
import { CurrentUser, TelegramAuthGuard } from './auth/telegram-auth.guard'
import type { User } from './auth/users'

@Controller('me')
@UseGuards(TelegramAuthGuard)
export class MeController {
  @Get()
  me(@CurrentUser() user: User): User {
    return user
  }
}
