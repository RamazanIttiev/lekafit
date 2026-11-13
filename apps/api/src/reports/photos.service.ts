import { PHOTO_ANGLES, type PhotoAngle, photoFileName } from '@lekafit/shared'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { type AppConfig, CONFIG } from '../config'
import { UsersRepository } from '../users/users.repository'
import {
  DOWNLOAD_LINK_TTL_MS,
  downloadSecret,
  signDownload,
  verifyDownload,
} from './photo-download-token'
import { type Photo, PhotosRepository } from './photos.repository'
import { type Report, ReportsRepository } from './reports.repository'
import { ReportsService } from './reports.service'

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const parseAngle = (text: string): PhotoAngle => {
  const angle = PHOTO_ANGLES.find((a) => a.key === text)
  if (!angle) throw new BadRequestException('Неизвестный ракурс')
  return angle.key
}

const mimeOf = (contentType: string | undefined) =>
  (contentType ?? '').split(';')[0]?.toLowerCase() ?? ''

const toPhoto = (contentType: string | undefined, body: unknown): Photo => {
  if (!Buffer.isBuffer(body) || body.length === 0)
    throw new BadRequestException('Нужно фото в формате JPEG, PNG или WebP')
  return { mime: mimeOf(contentType), data: body }
}

const found = (photo: Photo | null): Photo => {
  if (!photo) throw new NotFoundException()
  return photo
}

@Injectable()
export class PhotosService {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(PhotosRepository) private readonly photos: PhotosRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private get secret() {
    return downloadSecret(this.config.botToken)
  }

  private async editableMonthly(userId: number, id: number): Promise<Report> {
    const report = await this.reportsService.own(userId, id)
    if (report.kind !== 'MONTHLY')
      throw new ConflictException('Фото добавляются только в отчёт за месяц')
    if (report.submittedAt) throw new ConflictException('Отчёт уже отправлен')
    return report
  }

  async upload(input: {
    userId: number
    id: number
    angle: string
    contentType: string | undefined
    body: unknown
  }): Promise<Report> {
    const angle = parseAngle(input.angle)
    await this.editableMonthly(input.userId, input.id)
    await this.photos.save(input.id, angle, toPhoto(input.contentType, input.body))
    return this.reportsService.own(input.userId, input.id)
  }

  async remove(userId: number, id: number, angleText: string): Promise<Report> {
    const angle = parseAngle(angleText)
    await this.editableMonthly(userId, id)
    await this.photos.remove(id, angle)
    return this.reportsService.own(userId, id)
  }

  async ownPhoto(userId: number, id: number, angleText: string): Promise<Photo> {
    const angle = parseAngle(angleText)
    await this.reportsService.own(userId, id)
    return found(await this.photos.find(id, angle))
  }

  async coachPhoto(id: number, angleText: string): Promise<Photo> {
    const angle = parseAngle(angleText)
    const report = await this.reports.findById(id)
    if (!report?.submittedAt) throw new NotFoundException()
    return found(await this.photos.find(id, angle))
  }

  async coachDownloadLink(
    id: number,
    angleText: string,
  ): Promise<{ url: string; fileName: string }> {
    const angle = parseAngle(angleText)
    const { fileName } = await this.downloadable({ reportId: id, angle })
    const token = signDownload({
      secret: this.secret,
      target: { reportId: id, angle },
      expiresAt: this.config.now().getTime() + DOWNLOAD_LINK_TTL_MS,
    })
    return { url: `${this.config.webAppUrl}/api/photo-downloads/${token}`, fileName }
  }

  async download(token: string): Promise<{ photo: Photo; fileName: string }> {
    const target = verifyDownload({ secret: this.secret, token, now: this.config.now().getTime() })
    if (!target) throw new NotFoundException()
    return this.downloadable(target)
  }

  private async downloadable(target: {
    reportId: number
    angle: PhotoAngle
  }): Promise<{ photo: Photo; fileName: string }> {
    const report = await this.reports.findById(target.reportId)
    if (!report?.submittedAt) throw new NotFoundException()
    const photo = found(await this.photos.find(target.reportId, target.angle))
    const client = await this.users.findById(report.userId)
    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(' ')
    return {
      photo,
      fileName: photoFileName({
        clientName,
        periodStart: report.weekStart,
        angle: target.angle,
        mime: photo.mime,
      }),
    }
  }
}
