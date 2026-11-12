import { METRICS, type MetricKey } from '@lekafit/shared'
import type { Plan } from '../api'

export type PlanKey = MetricKey | 'trainingMonth' | 'cardioMonth'

const MONTHLY_TARGETS = [
  { key: 'trainingMonth', label: 'Тренировки в месяц', unit: 'раз', scope: 'месяц' },
  { key: 'cardioMonth', label: 'Кардио в месяц', unit: 'мин', scope: 'месяц' },
] as const

export const PLAN_FIELDS = [...METRICS, ...MONTHLY_TARGETS]

const asText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

export const planToText = (plan: Plan | null): Record<PlanKey, string> => ({
  cal: asText(plan?.cal),
  protein: asText(plan?.protein),
  fat: asText(plan?.fat),
  carb: asText(plan?.carb),
  steps: asText(plan?.steps),
  training: asText(plan?.training),
  trainingMonth: asText(plan?.trainingMonth),
  cardioMonth: asText(plan?.cardioMonth),
})
