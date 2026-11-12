import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { CoachGuard, TelegramAuthGuard } from '../auth/telegram-auth.guard'
import { PhotosService } from '../reports/photos.service'
import { CoachService } from './coach.service'

@Controller('coach')
@UseGuards(TelegramAuthGuard, CoachGuard)
export class CoachController {
  constructor(
    @Inject(CoachService) private readonly coach: CoachService,
    @Inject(PhotosService) private readonly photos: PhotosService,
  ) {}

  @Get('invite')
  invite() {
    return this.coach.invite()
  }

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

  @Get('reports/:id/photos/:angle')
  @Header('Cache-Control', 'private, no-store')
  async photo(@Param('id', ParseIntPipe) id: number, @Param('angle') angle: string) {
    const { mime, data } = await this.photos.coachPhoto(id, angle)
    return new StreamableFile(data, { type: mime })
  }

  @Post('reports/:id/photos/:angle/link')
  @HttpCode(200)
  photoLink(@Param('id', ParseIntPipe) id: number, @Param('angle') angle: string) {
    return this.photos.coachDownloadLink(id, angle)
  }

  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number) {
    return this.coach.report(id)
  }
}
