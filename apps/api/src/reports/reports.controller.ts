import {
  Body,
  Controller,
  Delete,
  Header,
  Headers,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser, TelegramAuthGuard } from '../auth/telegram-auth.guard'
import type { User } from '../users/users.repository'
import { PhotosService } from './photos.service'
import { ReportsService } from './reports.service'

@Controller('reports')
@UseGuards(TelegramAuthGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
    @Inject(PhotosService) private readonly photos: PhotosService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query('kind') kind?: string) {
    return this.reports.list(user.id, kind)
  }

  @Get('current')
  current(
    @CurrentUser() user: User,
    @Query('kind') kind?: string,
    @Query('week') week?: string,
  ) {
    return this.reports.current(user.id, kind, week)
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

  @Put(':id/photos/:angle')
  uploadPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('angle') angle: string,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
  ) {
    return this.photos.upload({ userId: user.id, id, angle, contentType, body })
  }

  @Delete(':id/photos/:angle')
  removePhoto(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('angle') angle: string,
  ) {
    return this.photos.remove(user.id, id, angle)
  }

  @Get(':id/photos/:angle')
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('angle') angle: string,
  ) {
    const { mime, data } = await this.photos.ownPhoto(user.id, id, angle)
    return new StreamableFile(data, { type: mime })
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.reports.submit(user.id, id)
  }
}
