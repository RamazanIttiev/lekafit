import {
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from '@heroui/react'
import { parseNumber } from '@lekafit/shared'
import { useEffect, useState } from 'react'
import type { ClientProfile, CoachApi, Plan } from '../../api'
import { Notice } from '../../components/Notice'
import { PLAN_FIELDS, type PlanKey, planToText } from '../plan'

export const PlanEditor = ({ api, profile }: { api: CoachApi; profile: ClientProfile }) => {
  const [values, setValues] = useState(planToText(profile.plan))
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  const fieldError = (key: PlanKey): string | null => {
    const value = values[key].trim()
    if (!value) return 'Обязательное поле'
    return parseNumber(value) === null ? 'Введите число' : null
  }

  const parsePlan = (): Plan | null => {
    if (PLAN_FIELDS.some((m) => fieldError(m.key))) {
      setSubmitted(true)
      setSaved(false)
      setMessage(null)
      return null
    }
    return {
      cal: parseNumber(values.cal),
      protein: parseNumber(values.protein),
      fat: parseNumber(values.fat),
      carb: parseNumber(values.carb),
      steps: parseNumber(values.steps),
      training: parseNumber(values.training),
      trainingMonth: parseNumber(values.trainingMonth),
      cardioMonth: parseNumber(values.cardioMonth),
    }
  }

  const askToConfirm = () => {
    if (parsePlan() === null) return
    setMessage(null)
    setConfirming(true)
  }

  const save = async (notify: boolean) => {
    const plan = parsePlan()
    if (plan === null) return
    setPending(true)
    try {
      await api.setPlan(profile.id, plan, { notify })
      setMessage(null)
      setSaved(true)
    } catch (e) {
      setSaved(false)
      setMessage(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>План</Card.Title>
        <Card.Description>Клиент видит его в отчёте</Card.Description>
      </Card.Header>
      <Card.Content className="grid grid-cols-2 gap-3">
        {PLAN_FIELDS.map((m) => (
          <TextField
            key={m.key}
            value={values[m.key]}
            isInvalid={submitted && fieldError(m.key) !== null}
            onChange={(v) => setValues({ ...values, [m.key]: v })}
          >
            <Label>{m.label}</Label>
            <Input inputMode="decimal" placeholder="—" />
            <Description>
              {m.unit} / {m.scope}
            </Description>
            <FieldError>{fieldError(m.key)}</FieldError>
          </TextField>
        ))}
      </Card.Content>
      <Card.Footer className="flex flex-col gap-2">
        <Button fullWidth onPress={askToConfirm}>
          Сохранить план
        </Button>
        <Modal.Backdrop isOpen={confirming} onOpenChange={setConfirming}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[360px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Сохранить план?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>Клиент увидит новый план в отчёте.</p>
              </Modal.Body>
              <Modal.Footer className="flex-col-reverse">
                <Button
                  className="w-full"
                  isDisabled={pending}
                  variant="secondary"
                  onPress={() => save(true)}
                >
                  Сохранить и отправить сообщение
                </Button>
                <Button className="w-full" isDisabled={pending} onPress={() => save(false)}>
                  Сохранить
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
        {message && <Notice status="danger">{message}</Notice>}
        {saved && (
          <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-2xl">
            <Notice status="success">План сохранён</Notice>
          </div>
        )}
      </Card.Footer>
    </Card>
  )
}
