import { createHmac, timingSafeEqual } from 'node:crypto'
import { PHOTO_ANGLES, type PhotoAngle } from '@lekafit/shared'
import { z } from 'zod'

export const DOWNLOAD_LINK_TTL_MS = 5 * 60 * 1000

export type DownloadTarget = { reportId: number; angle: PhotoAngle }

const signature = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

export const downloadSecret = (botToken: string) =>
  createHmac('sha256', 'lekafit-photo-download').update(botToken).digest('base64url')

export const signDownload = ({
  secret,
  target,
  expiresAt,
}: {
  secret: string
  target: DownloadTarget
  expiresAt: number
}): string => {
  const payload = Buffer.from(
    JSON.stringify({ r: target.reportId, a: target.angle, e: expiresAt }),
  ).toString('base64url')
  return `${payload}.${signature(secret, payload)}`
}

const sameSignature = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

const payloadSchema = z.object({
  r: z.number().int(),
  a: z.enum(PHOTO_ANGLES.map((a) => a.key)),
  e: z.number(),
})

export const verifyDownload = ({
  secret,
  token,
  now,
}: {
  secret: string
  token: string
  now: number
}): DownloadTarget | null => {
  const [payload = '', sig = ''] = token.split('.')
  if (!sameSignature(sig, signature(secret, payload))) return null
  const parsed = payloadSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
  return parsed.e < now ? null : { reportId: parsed.r, angle: parsed.a }
}
