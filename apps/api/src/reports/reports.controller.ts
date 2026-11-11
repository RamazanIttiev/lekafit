import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser, TelegramAuthGuard } from '../auth/telegram-auth.guard'
import type { User } from '../users/users.repository'
import { ReportsService } from './reports.service'

@Controller('reports')
@UseGuards(TelegramAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.reports.list(user.id)
  }

  @Get('current')
  current(@CurrentUser() user: User) {
    return this.reports.current(user.id)
  }

  @Get(':id')
  one(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.reports.own(user.id, id)
  }

  @Patch(':id')
  save(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { data?: unknown },
  ) {
    return this.reports.saveDraft(user.id, id, body.data)
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.reports.submit(user.id, id)
  }
}
