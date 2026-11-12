import { Controller, Get, Header, Inject, Param, StreamableFile } from '@nestjs/common'
import { PhotosService } from './photos.service'

const asciiFallback = (fileName: string) => fileName.replace(/[^\x20-\x7e]+/g, '').replace(/_+/g, '_')

const contentDisposition = (fileName: string) =>
  `attachment; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`

@Controller('photo-downloads')
export class PhotoDownloadsController {
  constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

  @Get(':token')
  @Header('Cache-Control', 'private, no-store')
  async download(@Param('token') token: string) {
    const { photo, fileName } = await this.photos.download(token)
    return new StreamableFile(photo.data, {
      type: photo.mime,
      disposition: contentDisposition(fileName),
    })
  }
}
