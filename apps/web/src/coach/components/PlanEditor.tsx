import { Button, Card, Description, Input, Label, TextField } from '@heroui/react'
import { parseNumber } from '@lekafit/shared'
import { useEffect, useState } from 'react'
import type { ClientProfile, CoachApi, Plan } from '../../api'
import { Notice } from '../../components/Notice'
import { PLAN_FIELDS, planToText } from '../plan'

export const PlanEditor = ({ api, profile }: { api: CoachApi; profile: ClientProfile }) => {
  const [values, setValues] = useState(planToText(profile.plan))
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  const save = async () => {
    const invalid = PLAN_FIELDS.filter(
      (m) => values[m.key].trim() && parseNumber(values[m.key]) === null,
    )
    if (invalid.length) {
      setSaved(false)
      setMessage(`Проверьте значения: ${invalid.map((m) => m.label).join(', ')}`)
      return
    }
    const plan: Plan = {
      cal: parseNumber(values.cal),
      protein: parseNumber(values.protein),
      fat: parseNumber(values.fat),
      carb: parseNumber(values.carb),
      steps: parseNumber(values.steps),
      training: parseNumber(values.training),
      trainingMonth: parseNumber(values.trainingMonth),
      cardioMonth: parseNumber(values.cardioMonth),
    }
    try {
      await api.setPlan(profile.id, plan)
      setMessage(null)
      setSaved(true)
    } catch (e) {
      setSaved(false)
      setMessage(e instanceof Error ? e.message : 'Не удалось сохранить')
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
            onChange={(v) => setValues({ ...values, [m.key]: v })}
          >
            <Label>{m.label}</Label>
            <Input inputMode="decimal" placeholder="—" />
            <Description>
              {m.unit} / {m.scope}
            </Description>
          </TextField>
        ))}
      </Card.Content>
      <Card.Footer className="flex flex-col gap-2">
        <Button fullWidth onPress={save}>
          Сохранить план
        </Button>
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
