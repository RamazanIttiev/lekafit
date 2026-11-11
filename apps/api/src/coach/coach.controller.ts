import { Body, Controller, Get, Inject, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common'
import { CoachGuard, TelegramAuthGuard } from '../auth/telegram-auth.guard'
import { CoachService } from './coach.service'

@Controller('coach')
@UseGuards(TelegramAuthGuard, CoachGuard)
export class CoachController {
  constructor(@Inject(CoachService) private readonly coach: CoachService) {}

  @Get('clients')
  clients() {
    return this.coach.clients()
  }

  @Get('clients/:id')
  clientProfile(@Param('id', ParseIntPipe) id: number) {
    return this.coach.clientProfile(id)
  }

  @Put('clients/:id/plan')
  setPlan(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.coach.setPlan(id, body)
  }

  @Get('clients/:id/reports')
  clientReports(@Param('id', ParseIntPipe) id: number) {
    return this.coach.clientReports(id)
  }

  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number) {
    return this.coach.report(id)
  }
}
