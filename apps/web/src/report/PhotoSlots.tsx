import { Button, Card } from '@heroui/react'
import { PHOTO_ANGLES, type PhotoAngle } from '@lekafit/shared'
import { useEffect, useState } from 'react'

type LoadPhoto = (reportId: number, angle: PhotoAngle) => Promise<Blob>

export type PhotoSlotsProps = {
  reportId: number
  photos: Record<PhotoAngle, boolean>
  prevReportId: number | null
  load: LoadPhoto
  readOnly: boolean
  isInvalid?: (path: string) => boolean
  onPick?: (angle: PhotoAngle, file: File) => Promise<void>
  onRemove?: (angle: PhotoAngle) => Promise<void>
  onDownload?: (angle: PhotoAngle) => Promise<void>
}

const frame =
  'flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-default p-2 text-center'

const PhotoImage = ({
  reportId,
  angle,
  load,
  alt,
}: {
  reportId: number
  angle: PhotoAngle
  load: LoadPhoto
  alt: string
}) => {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let objectUrl: string | null = null
    let active = true
    load(reportId, angle).then(
      (blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => active && setFailed(true),
    )
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [reportId, angle, load])
  if (failed)
    return <Card.Description className={frame}>Не удалось загрузить фото</Card.Description>
  if (!url) return <div className={frame} aria-busy="true" />
  return <img src={url} alt={alt} className={`${frame} object-contain`} />
}

const Slot = ({
  angle,
  label,
  props,
  version,
  onPicked,
}: {
  angle: PhotoAngle
  label: string
  props: PhotoSlotsProps
  version: number
  onPicked: () => void
}) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const present = props.photos[angle]
  const invalid = props.isInvalid?.(`photos.${angle}`) ?? false

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить фото')
    } finally {
      setBusy(false)
    }
  }

  const pick = (file: File | undefined) => {
    const { onPick } = props
    if (!file || !onPick) return
    run(async () => {
      await onPick(angle, file)
      onPicked()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Card.Title>{label}</Card.Title>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Card.Description>Прошлый месяц</Card.Description>
          {props.prevReportId === null ? (
            <Card.Description className={frame}>В прошлом месяце фото нет</Card.Description>
          ) : (
            <PhotoImage
              reportId={props.prevReportId}
              angle={angle}
              load={props.load}
              alt={`${label} — прошлый месяц`}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Card.Description>Этот месяц</Card.Description>
          {present ? (
            <PhotoImage
              key={version}
              reportId={props.reportId}
              angle={angle}
              load={props.load}
              alt={`${label} — этот месяц`}
            />
          ) : (
            <Card.Description className={`${frame} ${invalid ? 'outline-2 outline-danger' : ''}`}>
              Нет фото
            </Card.Description>
          )}
        </div>
      </div>
      {!props.readOnly && (
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`button button--md button--secondary cursor-pointer text-center ${busy ? 'opacity-50' : ''}`}
          >
            {busy ? 'Загружаю…' : present ? 'Заменить' : 'Добавить фото'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={`Выбрать фото: ${label}`}
              aria-invalid={invalid}
              disabled={busy}
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {present && props.onRemove && (
            <Button
              variant="danger-soft"
              aria-label={`Удалить фото: ${label}`}
              isDisabled={busy}
              onPress={() => {
                const { onRemove } = props
                if (onRemove) run(() => onRemove(angle))
              }}
            >
              Удалить
            </Button>
          )}
        </div>
      )}
      {present && props.onDownload && (
        <Button
          variant="secondary"
          aria-label={`Скачать фото: ${label}`}
          isDisabled={busy}
          onPress={() => {
            const { onDownload } = props
            if (onDownload) run(() => onDownload(angle))
          }}
        >
          Скачать
        </Button>
      )}
      {error && <Card.Description className="text-danger">{error}</Card.Description>}
    </div>
  )
}

export const PhotoSlots = (props: PhotoSlotsProps) => {
  const [versions, setVersions] = useState<Record<PhotoAngle, number>>({
    front: 0,
    side: 0,
    back: 0,
  })
  return (
    <div className="flex flex-col gap-5">
      {PHOTO_ANGLES.map((a) => (
        <Slot
          key={a.key}
          angle={a.key}
          label={a.label}
          props={props}
          version={versions[a.key]}
          onPicked={() => setVersions((v) => ({ ...v, [a.key]: v[a.key] + 1 }))}
        />
      ))}
    </div>
  )
}
