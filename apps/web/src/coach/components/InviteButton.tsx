import { Button } from '@heroui/react'
import { useState } from 'react'
import type { CoachApi } from '../../api'
import { Notice } from '../../components/Notice'

const INVITE_TEXT = 'Привет! Это LekaFit — здесь вы будете заполнять недельный отчёт для тренера.'

export const InviteButton = ({
  api,
  share,
}: {
  api: CoachApi
  share: (url: string, text: string) => void
}) => {
  const [error, setError] = useState<string | null>(null)
  const invite = async () => {
    try {
      const { url } = await api.invite()
      setError(null)
      share(url, INVITE_TEXT)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось получить ссылку')
    }
  }
  return (
    <>
      <Button fullWidth onPress={invite}>
        Добавить клиента
      </Button>
      {error && <Notice status="danger">{error}</Notice>}
    </>
  )
}
