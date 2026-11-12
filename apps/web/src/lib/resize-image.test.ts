import { describe, expect, it } from 'vitest'
import { resizeImage } from './resize-image'

const pngOf = (width: number, height: number): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#a080c0'
    ctx.fillRect(0, 0, width, height)
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png'),
  )
}

const sizeOf = async (blob: Blob) => {
  const bitmap = await createImageBitmap(blob)
  return { width: bitmap.width, height: bitmap.height }
}

describe('resizeImage', () => {
  it('shrinks the longest side to 1600 px and keeps the proportions', async () => {
    const resized = await resizeImage(await pngOf(3200, 1000))
    expect(resized.type).toBe('image/jpeg')
    expect(await sizeOf(resized)).toEqual({ width: 1600, height: 500 })
  })

  it('handles portrait photos', async () => {
    const resized = await resizeImage(await pngOf(1200, 2400))
    expect(await sizeOf(resized)).toEqual({ width: 800, height: 1600 })
  })

  it('does not enlarge small photos but still converts them to JPEG', async () => {
    const resized = await resizeImage(await pngOf(400, 300))
    expect(resized.type).toBe('image/jpeg')
    expect(await sizeOf(resized)).toEqual({ width: 400, height: 300 })
  })

  it('fails with a readable message for something that is not an image', async () => {
    await expect(resizeImage(new Blob(['not an image'], { type: 'image/jpeg' }))).rejects.toThrow(
      'Не удалось открыть фото',
    )
  })
})
