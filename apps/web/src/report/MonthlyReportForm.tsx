import { Card, Input, Label, TextField } from '@heroui/react'
import {
  formatDelta,
  GOALS,
  MONTHLY_FEEDBACK,
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  type Plan,
  parseNumber,
} from '@lekafit/shared'
import type { ReactNode } from 'react'
import type { MonthlyReportData } from '../api'
import {
  ChoiceField,
  FeedbackFields,
  GridHead,
  MetricName,
  PlanFactRows,
  ReportTabs,
  Row,
  Section,
  Value,
  WellbeingFields,
} from './parts'
import { NoPlanNotice } from './ReportForm'

type Props = {
  data: MonthlyReportData
  plan: Plan | null
  readOnly: boolean
  showComputed?: boolean
  invalid?: ReadonlySet<string>
  onChange: (data: MonthlyReportData) => void
  photos?: ReactNode
}

type MetricKey = (typeof MONTHLY_METRICS)[number]['key']

const COMPLETION = [
  { key: 'training', label: 'Тренировки' },
  { key: 'steps', label: 'Средние шаги' },
] as const

const coachPlanFor =
  (plan: Plan | null) =>
  (key: MetricKey): number | null => {
    if (key === 'training') return plan?.trainingMonth ?? null
    if (key === 'cardio') return plan?.cardioMonth ?? null
    return plan?.[key] ?? null
  }

const ignore = () => undefined

const ComputedActivity = ({ data, plan }: { data: MonthlyReportData; plan: Plan | null }) => (
  <Section
    title="Питание и активность"
    hint="Среднее по недельным отчётам за месяц. Тренировки и кардио — сумма за месяц."
  >
    <div className="flex flex-col gap-3">
      {plan === null && <NoPlanNotice />}
      <PlanFactRows
        metrics={MONTHLY_METRICS}
        completion={COMPLETION}
        plan={data.plan}
        fact={data.fact}
        coachPlan={coachPlanFor(plan)}
        readOnly
        isInvalid={() => false}
        onPlan={ignore}
        onFact={ignore}
      />
    </div>
  </Section>
)

const ComputedMeasures = ({ data }: { data: MonthlyReportData }) => (
  <Section title="Замеры" hint="Среднее по недельным отчётам за месяц">
    <div className="flex flex-col gap-4">
      <GridHead columns={['Показатель', 'Старт', 'Было', 'Стало']} />
      {MONTHLY_MEASURES.map((m) => (
        <div key={m.key} className="flex flex-col gap-1">
          <Row>
            <MetricName label={m.label} unit={m.unit} />
            <Value label={`Старт ${m.label}`}>{data.baseline[m.key] || '—'}</Value>
            <Value label={`Было ${m.label}`}>{data.prev[m.key] || '—'}</Value>
            <Value label={`Стало ${m.label}`}>{data.now[m.key] || '—'}</Value>
          </Row>
          <Card.Description className="flex justify-end gap-4">
            <span>
              За месяц:{' '}
              <Value label={`За месяц ${m.label}`}>
                {formatDelta({
                  from: parseNumber(data.prev[m.key]),
                  to: parseNumber(data.now[m.key]),
                  unit: m.unit,
                })}
              </Value>
            </span>
            <span>
              От старта:{' '}
              <Value label={`От старта ${m.label}`}>
                {formatDelta({
                  from: parseNumber(data.baseline[m.key]),
                  to: parseNumber(data.now[m.key]),
                  unit: m.unit,
                })}
              </Value>
            </span>
          </Card.Description>
        </div>
      ))}
    </div>
  </Section>
)

export const MonthlyReportForm = ({
  data,
  plan,
  readOnly,
  showComputed = false,
  invalid = new Set(),
  onChange,
  photos,
}: Props) => {
  const set = <K extends keyof MonthlyReportData>(
    section: K,
    patch: Partial<MonthlyReportData[K]>,
  ) => onChange({ ...data, [section]: { ...data[section], ...patch } })
  const isInvalid = (path: string) => invalid.has(path)

  return (
    <ReportTabs
      panels={{
        ...(showComputed
          ? {
              activity: <ComputedActivity data={data} plan={plan} />,
              measures: <ComputedMeasures data={data} />,
            }
          : {}),
        wellbeing: (
          <div className="flex flex-col gap-3">
            <Section title="Цель">
              <div className="flex flex-col gap-3">
                <ChoiceField
                  label="Основная цель работы"
                  options={GOALS}
                  value={data.about.goal}
                  readOnly={readOnly}
                  invalid={false}
                  onChange={(goal) => set('about', { goal })}
                />
                <TextField
                  value={data.about.startDate}
                  isDisabled={readOnly}
                  onChange={(startDate) => set('about', { startDate })}
                >
                  <Label>Начало сопровождения</Label>
                  <Input type="date" />
                </TextField>
              </div>
            </Section>
            <Section title="Самочувствие" hint="Оценка месяца в целом">
              <WellbeingFields
                items={MONTHLY_WELLBEING}
                values={data.wellbeing}
                note={data.wellbeing.note}
                readOnly={readOnly}
                isInvalid={isInvalid}
                onChange={(key, v) => set('wellbeing', { [key]: v })}
                onNote={(note) => set('wellbeing', { note })}
              />
            </Section>
          </div>
        ),
        feedback: (
          <Section title="Итоги месяца" hint="Коротко и по существу">
            <FeedbackFields
              items={MONTHLY_FEEDBACK}
              values={data.feedback}
              readOnly={readOnly}
              isInvalid={isInvalid}
              onChange={(key, v) => set('feedback', { [key]: v })}
            />
          </Section>
        ),
      }}
      extra={
        photos
          ? [
              {
                id: 'photos',
                label: 'Фото',
                icon: (
                  <>
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </>
                ),
                panel: (
                  <Section
                    title="Фото"
                    hint="Фото за текущий месяц. За прошлый месяц фото добавятся автоматически из прошлого"
                  >
                    {photos}
                  </Section>
                ),
              },
            ]
          : []
      }
    />
  )
}
