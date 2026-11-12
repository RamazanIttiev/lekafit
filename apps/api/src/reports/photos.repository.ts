import type { PhotoAngle } from '@lekafit/shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { ReportPhotoEntity } from './report-photo.entity'

export type Photo = { mime: string; data: Buffer }

@Injectable()
export class PhotosRepository {
  constructor(
    @InjectRepository(ReportPhotoEntity) private readonly photos: Repository<ReportPhotoEntity>,
  ) {}

  async find(reportId: number, angle: PhotoAngle): Promise<Photo | null> {
    const photo = await this.photos.findOneBy({ reportId, angle })
    return photo && { mime: photo.mime, data: photo.data }
  }

  async save(reportId: number, angle: PhotoAngle, photo: Photo): Promise<void> {
    await this.photos.upsert(
      { reportId, angle, ...photo, uploadedAt: new Date() },
      ['reportId', 'angle'],
    )
  }

  async remove(reportId: number, angle: PhotoAngle): Promise<void> {
    await this.photos.delete({ reportId, angle })
  }
}
