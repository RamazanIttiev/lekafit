const MAX_SIDE = 1600
const QUALITY = 0.85
const UNREADABLE = 'Не удалось открыть фото'

const decode = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(UNREADABLE))
    }
    img.src = url
  })

export const resizeImage = async (file: Blob): Promise<Blob> => {
  const img = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(UNREADABLE)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(UNREADABLE))),
      'image/jpeg',
      QUALITY,
    ),
  )
}
