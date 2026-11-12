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
export type Unit =
  | (typeof METRICS)[number]['unit']
  | (typeof MEASURES)[number]['unit']
  | (typeof MONTHLY_METRICS)[number]['unit']

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
  trainingMonth: planValue.default(null),
  cardioMonth: planValue.default(null),
})

export type Plan = z.infer<typeof planSchema>

export const parseNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || !value.trim()) return null
  const n = Number(value.replace(/[\s ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const formatNumber = (n: number, digits: number): string =>
  Number(n.toFixed(digits)).toLocaleString('ru-RU')

const WHOLE_UNITS: readonly Unit[] = ['ккал', 'шагов', 'раз', 'мин']

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

export const MONTHLY_METRICS = [
  ...METRICS.filter((m) => m.key !== 'training'),
  { key: 'training', label: 'Силовые тренировки', unit: 'раз', scope: 'месяц' },
  { key: 'cardio', label: 'Кардио', unit: 'мин', scope: 'месяц' },
] as const

export const MONTHLY_MEASURES = [
  ...MEASURES,
  { key: 'thigh', label: 'Обхват бедра', unit: 'см' },
] as const

export const MONTHLY_WELLBEING = [
  ...WELLBEING,
  {
    key: 'planEase',
    label: 'Соблюдение плана',
    options: [
      'Почти без сложностей',
      'В целом получалось',
      'Были заметные трудности',
      'План часто не выполнялся',
    ],
  },
  {
    key: 'healthChange',
    label: 'Самочувствие относительно прошлого месяца',
    options: [
      'Значительно лучше',
      'Немного лучше',
      'Без заметных изменений',
      'Немного хуже',
      'Значительно хуже',
      'Первый месяц — не сравниваю',
    ],
  },
  {
    key: 'consistency',
    label: 'Питание по плану в течение месяца',
    options: [
      'Почти каждый день',
      'Большую часть месяца',
      'Примерно половину месяца',
      'Реже половины месяца',
    ],
  },
] as const

export const MONTHLY_FEEDBACK = [
  { key: 'wins', label: 'Главные достижения и изменения за месяц' },
  { key: 'issues', label: 'Что мешало выполнять план?' },
  { key: 'changes', label: 'Что изменилось по ощущениям или по одежде?' },
  { key: 'questions', label: 'Вопросы к тренеру и пожелания на следующий месяц' },
] as const

export const GOALS = [
  'Снижение жировой массы',
  'Набор мышечной массы',
  'Рекомпозиция тела',
  'Поддержание формы',
  'Здоровье и пищевые привычки',
  'Другое',
] as const

const OPTIONAL_MONTHLY_METRICS: readonly string[] = ['cardio']

const monthlyMetricValues = z
  .object({
    cal: numericText,
    protein: numericText,
    fat: numericText,
    carb: numericText,
    steps: numericText,
    training: numericText,
    cardio: numericText,
  })
  .prefault({})

const monthlyMeasureValues = z
  .object({
    weight: numericText,
    chest: numericText,
    waist: numericText,
    hips: numericText,
    glutes: numericText,
    arm: numericText,
    thigh: numericText,
  })
  .prefault({})

export const monthlyReportDataSchema = z.object({
  about: z
    .object({ startDate: z.string().max(10).default(''), goal: optionOrEmpty(GOALS) })
    .prefault({}),
  plan: monthlyMetricValues,
  fact: monthlyMetricValues,
  baseline: monthlyMeasureValues,
  prev: monthlyMeasureValues,
  now: monthlyMeasureValues,
  wellbeing: z
    .object({
      sleep: optionOrEmpty(MONTHLY_WELLBEING[0].options),
      energy: optionOrEmpty(MONTHLY_WELLBEING[1].options),
      stress: optionOrEmpty(MONTHLY_WELLBEING[2].options),
      hunger: optionOrEmpty(MONTHLY_WELLBEING[3].options),
      sweet: optionOrEmpty(MONTHLY_WELLBEING[4].options),
      digestion: optionOrEmpty(MONTHLY_WELLBEING[5].options),
      planEase: optionOrEmpty(MONTHLY_WELLBEING[6].options),
      healthChange: optionOrEmpty(MONTHLY_WELLBEING[7].options),
      consistency: optionOrEmpty(MONTHLY_WELLBEING[8].options),
      note: text,
    })
    .prefault({}),
  feedback: z.object({ wins: text, issues: text, changes: text, questions: text }).prefault({}),
})

export type MonthlyReportData = z.infer<typeof monthlyReportDataSchema>

export const monthRange = (today: Date): { start: string; end: string } => ({
  start: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  end: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
})

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export const monthName = (isoDate: string): string =>
  `${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}`

export const monthlyMissingFields = (data: MonthlyReportData): string[] => [
  ...MONTHLY_METRICS.filter(
    (m) => !OPTIONAL_MONTHLY_METRICS.includes(m.key) && !hasNumber(data.fact[m.key]),
  ).map((m) => `fact.${m.key}`),
  ...MONTHLY_MEASURES.filter((m) => !hasNumber(data.now[m.key])).map((m) => `now.${m.key}`),
  ...MONTHLY_WELLBEING.filter((w) => !hasText(data.wellbeing[w.key])).map(
    (w) => `wellbeing.${w.key}`,
  ),
  ...MONTHLY_FEEDBACK.filter((f) => !hasText(data.feedback[f.key])).map((f) => `feedback.${f.key}`),
]

export const REPORT_KINDS = ['WEEKLY', 'MONTHLY'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const PHOTO_ANGLES = [
  { key: 'front', label: 'Фас' },
  { key: 'side', label: 'Профиль' },
  { key: 'back', label: 'Спина' },
] as const
export type PhotoAngle = (typeof PHOTO_ANGLES)[number]['key']
