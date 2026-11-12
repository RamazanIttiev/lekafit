import { z } from 'zod'

export const METRICS = [
  { key: 'cal', label: 'Калории', unit: 'ккал', scope: 'день' },
  { key: 'protein', label: 'Белки', unit: 'г', scope: 'день' },
  { key: 'fat', label: 'Жиры', unit: 'г', scope: 'день' },
  { key: 'carb', label: 'Углеводы', unit: 'г', scope: 'день' },
  { key: 'steps', label: 'Шаги', unit: 'шагов', scope: 'день' },
  { key: 'training', label: 'Тренировки', unit: 'раз', scope: 'неделя' },
] as const

export const MEASURES = [
  { key: 'weight', label: 'Вес', unit: 'кг' },
  { key: 'chest', label: 'Грудь', unit: 'см' },
  { key: 'waist', label: 'Талия', unit: 'см' },
  { key: 'hips', label: 'Бёдра', unit: 'см' },
  { key: 'glutes', label: 'Ягодицы', unit: 'см' },
  { key: 'arm', label: 'Бицепс руки', unit: 'см' },
] as const

export const WELLBEING = [
  {
    key: 'sleep',
    label: 'Сон — средняя продолжительность',
    options: ['Менее 6 часов', '6–7 часов', '7–8 часов', '8–9 часов', 'Более 9 часов'],
  },
  {
    key: 'energy',
    label: 'Энергия',
    options: ['1 — очень низкая', '2 — низкая', '3 — средняя', '4 — хорошая', '5 — высокая'],
  },
  {
    key: 'stress',
    label: 'Стресс',
    options: ['1 — минимальный', '2 — низкий', '3 — умеренный', '4 — высокий', '5 — очень высокий'],
  },
  {
    key: 'hunger',
    label: 'Голод / аппетит',
    options: ['1 — почти нет', '2 — слабый', '3 — умеренный', '4 — выраженный', '5 — сильный'],
  },
  {
    key: 'sweet',
    label: 'Тяга к сладкому',
    options: [
      '1 — отсутствует',
      '2 — слабая',
      '3 — периодическая',
      '4 — выраженная',
      '5 — постоянная',
    ],
  },
  {
    key: 'digestion',
    label: 'Пищеварение',
    options: [
      'Без жалоб',
      'Эпизодический дискомфорт',
      'Вздутие',
      'Запор',
      'Жидкий стул',
      'Смешанные симптомы',
    ],
  },
] as const

export const FEEDBACK = [
  { key: 'wins', label: 'Что получилось хорошо?' },
  { key: 'issues', label: 'Что было сложно?' },
  { key: 'changes', label: 'Какие изменения заметили?' },
  { key: 'nextWeek', label: 'На чём хотите сосредоточиться на следующей неделе?' },
] as const

export type MetricKey = (typeof METRICS)[number]['key']
export type MeasureKey = (typeof MEASURES)[number]['key']
export type Unit = (typeof METRICS)[number]['unit'] | (typeof MEASURES)[number]['unit']

const numericText = z.string().max(20).default('')
const text = z.string().max(4000).default('')

const optionOrEmpty = <T extends readonly [string, ...string[]]>(options: T) =>
  z.union([z.literal(''), z.enum(options)]).default('')

const metricValues = z
  .object({
    cal: numericText,
    protein: numericText,
    fat: numericText,
    carb: numericText,
    steps: numericText,
    training: numericText,
  })
  .prefault({})

const measureValues = z
  .object({
    weight: numericText,
    chest: numericText,
    waist: numericText,
    hips: numericText,
    glutes: numericText,
    arm: numericText,
  })
  .prefault({})

export const reportDataSchema = z.object({
  plan: metricValues,
  fact: metricValues,
  prev: measureValues,
  now: measureValues,
  wellbeing: z
    .object({
      sleep: optionOrEmpty(WELLBEING[0].options),
      energy: optionOrEmpty(WELLBEING[1].options),
      stress: optionOrEmpty(WELLBEING[2].options),
      hunger: optionOrEmpty(WELLBEING[3].options),
      sweet: optionOrEmpty(WELLBEING[4].options),
      digestion: optionOrEmpty(WELLBEING[5].options),
      note: text,
    })
    .prefault({}),
  feedback: z.object({ wins: text, issues: text, changes: text, nextWeek: text }).prefault({}),
})

export type ReportData = z.infer<typeof reportDataSchema>

const planValue = z.number().nonnegative().nullable()

export const planSchema = z.object({
  cal: planValue,
  protein: planValue,
  fat: planValue,
  carb: planValue,
  steps: planValue,
  training: planValue,
})

export type Plan = z.infer<typeof planSchema>

export const parseNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || !value.trim()) return null
  const n = Number(value.replace(/[\s ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const formatNumber = (n: number, digits: number): string =>
  Number(n.toFixed(digits)).toLocaleString('ru-RU')

const WHOLE_UNITS: readonly Unit[] = ['ккал', 'шагов', 'раз']

export const formatDelta = ({
  from,
  to,
  unit,
}: {
  from: number | null
  to: number | null
  unit: Unit
}): string => {
  if (from === null || to === null) return '—'
  const diff = to - from
  const formatted = formatNumber(diff, WHOLE_UNITS.includes(unit) ? 0 : 1)
  return diff > 0 ? `+${formatted}` : formatted
}

export const completionPercent = ({
  plan,
  fact,
}: {
  plan: number | null
  fact: number | null
}): string => {
  if (plan === null || fact === null || plan <= 0) return '—'
  return `${formatNumber((fact / plan) * 100, 0)}%`
}

const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const weekRange = (today: Date): { start: string; end: string } => {
  const daysSinceMonday = (today.getDay() + 6) % 7
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return { start: isoDate(start), end: isoDate(end) }
}

const hasNumber = (value: string) => parseNumber(value) !== null
const hasText = (value: string) => value.trim() !== ''

export const missingFields = (data: ReportData): string[] => [
  ...METRICS.filter((m) => !hasNumber(data.fact[m.key])).map((m) => `fact.${m.key}`),
  ...MEASURES.filter((m) => !hasNumber(data.now[m.key])).map((m) => `now.${m.key}`),
  ...WELLBEING.filter((w) => !hasText(data.wellbeing[w.key])).map((w) => `wellbeing.${w.key}`),
  ...FEEDBACK.filter((f) => !hasText(data.feedback[f.key])).map((f) => `feedback.${f.key}`),
]
